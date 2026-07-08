/**
 * worker.js - Local Baileys worker.
 * Roda NO SEU PC com IP residencial brasileiro.
 * Conecta ao servidor Render como worker e processa sessões WhatsApp localmente.
 *
 * Como usar:
 *   node worker.js
 *   (ou: npm run worker)
 */
import { io } from 'socket.io-client';
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { rm, mkdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ---- Config ----
const WORKER_SECRET = process.env.WORKER_SECRET || 'donate-worker-2025';
const SERVER_URL    = process.env.SERVER_URL    || 'https://donate-accounts.onrender.com';

// ---- Credentials ----
const GAME_CREDENTIALS = {
    'blox-fruits': { username: 'SummerCarroll4594', password: 'vix@#!@931659' },
    'grow-garden': { username: '@v_Velocity2',      password: 'K2pOc60z43GT'  }
};

const OUT_OF_STOCK_AFTER = new Set(['free-fire']);

// ---- Active sessions ----
const activeSessions = new Map();

// ---- Connect to Render server as worker ----
console.log(`\n🤖  Donate Accounts — Worker Local`);
console.log(`📡  Conectando ao servidor: ${SERVER_URL}\n`);

const socket = io(SERVER_URL, {
    auth:              { secret: WORKER_SECRET, role: 'worker' },
    reconnection:      true,
    reconnectionDelay: 3000,
    timeout:           10000
});

socket.on('connect', () => {
    console.log(`✅  Worker autenticado! ID: ${socket.id}`);
    console.log(`🟢  Aguardando sessões de usuários...\n`);
});

socket.on('connect_error', (err) => {
    console.error(`❌  Erro de conexão: ${err.message}`);
});

socket.on('disconnect', (reason) => {
    console.log(`⚠️   Desconectado (${reason}). Reconectando...`);
});

socket.on('authError', (msg) => {
    console.error(`🔒  Autenticação recusada: ${msg}`);
    process.exit(1);
});

// ---- Handle session requests from server ----
socket.on('createSession', async ({ userSocketId, gameType, phone }) => {
    console.log(`[${userSocketId}] Nova sessão: ${gameType} | ${phone}`);
    await createWhatsAppSession(userSocketId, gameType, phone);
});

socket.on('cleanupSession', ({ userSocketId }) => {
    console.log(`[${userSocketId}] Limpando sessão (usuário desconectou)`);
    cleanupSession(userSocketId);
});

// ---- Baileys session ----
async function createWhatsAppSession(userSocketId, gameType, phone) {
    const sessionDir = join(__dirname, 'sessions', userSocketId);

    try {
        await mkdir(sessionDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version }          = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: ['Ubuntu', 'Chrome', '120.0.0'],
            logger: {
                level: 'silent',
                info:  () => {}, error: () => {}, warn:  () => {},
                debug: () => {}, trace: () => {}, fatal: () => {},
                child() { return this; }
            }
        });

        activeSessions.set(userSocketId, { sock, sessionDir, gameType });

        let pairingCodeRequested = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Quando QR está pronto, pede pairing code pelo número
            if (qr && !pairingCodeRequested) {
                pairingCodeRequested = true;
                try {
                    const code      = await sock.requestPairingCode(phone);
                    const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                    console.log(`[${userSocketId}] Pairing code gerado: ${formatted}`);
                    socket.emit('pairingCode', { userSocketId, code: formatted });
                } catch (err) {
                    console.error(`[${userSocketId}] Erro no pairing code:`, err.message);
                    socket.emit('workerError', {
                        userSocketId,
                        message: 'Erro ao gerar código. Verifique o número e tente novamente.'
                    });
                    cleanupSession(userSocketId);
                }
            }

            // Conexão aberta — enviar credenciais
            if (connection === 'open') {
                console.log(`[${userSocketId}] ✅ WhatsApp conectado! Jogo: ${gameType}`);

                if (OUT_OF_STOCK_AFTER.has(gameType)) {
                    socket.emit('workerOutOfStock', { userSocketId });
                } else {
                    socket.emit('workerConnected', {
                        userSocketId,
                        credentials: GAME_CREDENTIALS[gameType]
                    });
                }

                setTimeout(async () => {
                    try { await sock.logout(); } catch (_) {}
                    cleanupSession(userSocketId);
                }, 3000);
            }

            // Conexão fechada
            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode;
                console.log(`[${userSocketId}] Conexão fechada. Código: ${code}`);

                if (code === DisconnectReason.loggedOut) {
                    socket.emit('workerSessionExpired', {
                        userSocketId,
                        message: 'Sessão expirada. Tente novamente.'
                    });
                } else if (code) {
                    socket.emit('workerError', {
                        userSocketId,
                        message: 'Conexão perdida. Tente novamente.'
                    });
                }
                cleanupSession(userSocketId);
            }
        });

        sock.ev.on('creds.update', saveCreds);

    } catch (err) {
        console.error(`[${userSocketId}] Erro ao criar sessão:`, err.message);
        socket.emit('workerError', {
            userSocketId,
            message: 'Erro interno. Tente novamente.'
        });
        cleanupSession(userSocketId);
    }
}

async function cleanupSession(userSocketId) {
    const session = activeSessions.get(userSocketId);
    if (session) {
        try {
            session.sock?.ev?.removeAllListeners();
            await rm(session.sessionDir, { recursive: true, force: true });
        } catch (_) {}
        activeSessions.delete(userSocketId);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑  Encerrando worker...');
    for (const [id] of activeSessions) await cleanupSession(id);
    process.exit(0);
});
