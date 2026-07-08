/**
 * animations.js - Visual effects: particles, confetti, fireflies, grass, waves
 */

// ---- Particle System (Blox Fruits: bubbles/fruits, Grow Garden: leaves/flowers) ----
const PARTICLE_EMOJIS = {
    'blox-fruits': ['🍎', '🍇', '🍊', '🫐', '🌊', '⚡', '🔥', '💎', '⭐', '🍌'],
    'grow-garden': ['🌿', '🍀', '🌸', '🌻', '🌺', '🦋', '🐝', '🌱', '💐', '🍃'],
    'free-fire': ['🔥', '💎', '⚔️', '🎯', '💥', '🏆', '⭐', '🔫', '🛡️', '👑']
};

export function initParticles(gameType) {
    const container = document.getElementById('particles');
    if (!container) return;

    const emojis = PARTICLE_EMOJIS[gameType] || PARTICLE_EMOJIS['blox-fruits'];
    const particleCount = window.innerWidth < 768 ? 12 : 20;

    function createParticle() {
        const particle = document.createElement('span');
        particle.className = 'particle';
        particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];

        // Random position and timing
        particle.style.left = Math.random() * 100 + '%';
        particle.style.fontSize = (0.8 + Math.random() * 1.5) + 'rem';
        particle.style.animationDuration = (8 + Math.random() * 15) + 's';
        particle.style.animationDelay = (Math.random() * 10) + 's';
        particle.style.opacity = 0.3 + Math.random() * 0.4;

        container.appendChild(particle);

        // Remove and recreate after animation ends
        const duration = parseFloat(particle.style.animationDuration) * 1000;
        const delay = parseFloat(particle.style.animationDelay) * 1000;
        setTimeout(() => {
            particle.remove();
            createParticle();
        }, duration + delay);
    }

    for (let i = 0; i < particleCount; i++) {
        setTimeout(() => createParticle(), Math.random() * 5000);
    }
}

// ---- Confetti System ----
const CONFETTI_COLORS = [
    '#FF6B35', '#FFD700', '#FF5722', '#E91E63',
    '#9C27B0', '#2196F3', '#00BCD4', '#4CAF50',
    '#8BC34A', '#FFEB3B', '#FF9800', '#F44336'
];

export function launchConfetti() {
    const container = document.getElementById('confetti');
    if (!container) return;

    container.innerHTML = '';
    const pieceCount = window.innerWidth < 768 ? 60 : 120;

    for (let i = 0; i < pieceCount; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';

        const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
        const shapes = ['circle', 'square', 'rectangle'];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];

        piece.style.backgroundColor = color;
        piece.style.left = Math.random() * 100 + '%';
        piece.style.animationDuration = (2 + Math.random() * 3) + 's';
        piece.style.animationDelay = (Math.random() * 1.5) + 's';

        if (shape === 'circle') {
            piece.style.borderRadius = '50%';
            piece.style.width = piece.style.height = (6 + Math.random() * 8) + 'px';
        } else if (shape === 'rectangle') {
            piece.style.width = (4 + Math.random() * 6) + 'px';
            piece.style.height = (10 + Math.random() * 14) + 'px';
            piece.style.borderRadius = '2px';
        } else {
            piece.style.width = piece.style.height = (6 + Math.random() * 8) + 'px';
            piece.style.borderRadius = '2px';
        }

        container.appendChild(piece);
    }

    // Clean up after animations complete
    setTimeout(() => {
        container.innerHTML = '';
    }, 6000);
}

// ---- Fireflies (Grow A Garden) ----
export function initFireflies() {
    const body = document.body;
    const count = window.innerWidth < 768 ? 6 : 12;

    for (let i = 0; i < count; i++) {
        const firefly = document.createElement('div');
        firefly.className = 'firefly';
        firefly.style.left = Math.random() * 100 + '%';
        firefly.style.top = (20 + Math.random() * 60) + '%';
        firefly.style.animationDuration = (6 + Math.random() * 8) + 's';
        firefly.style.animationDelay = (Math.random() * 5) + 's';
        firefly.style.width = firefly.style.height = (3 + Math.random() * 5) + 'px';
        body.appendChild(firefly);
    }
}

// ---- Grass Blades (Grow A Garden) ----
export function initGrass() {
    const container = document.querySelector('.grass-container');
    if (!container) return;

    const bladeCount = Math.floor(window.innerWidth / 8);
    for (let i = 0; i < bladeCount; i++) {
        const blade = document.createElement('div');
        blade.className = 'grass-blade';
        blade.style.left = (i / bladeCount * 100) + '%';
        blade.style.height = (20 + Math.random() * 30) + 'px';
        blade.style.animationDelay = (Math.random() * 3) + 's';
        blade.style.animationDuration = (2 + Math.random() * 2) + 's';
        container.appendChild(blade);
    }
}

// ---- Waves (Blox Fruits) ----
export function initWaves() {
    const container = document.querySelector('.waves-container');
    if (!container) return;

    // Waves are defined in CSS, just ensure container is visible
    container.style.display = 'block';
}

// ---- Embers (Free Fire) ----
export function initEmbers() {
    const body = document.body;
    const count = window.innerWidth < 768 ? 8 : 15;

    for (let i = 0; i < count; i++) {
        const ember = document.createElement('div');
        ember.className = 'ember';
        ember.style.left = Math.random() * 100 + '%';
        ember.style.bottom = (Math.random() * 20) + '%';
        ember.style.animationDuration = (3 + Math.random() * 5) + 's';
        ember.style.animationDelay = (Math.random() * 4) + 's';
        ember.style.width = ember.style.height = (2 + Math.random() * 4) + 'px';
        body.appendChild(ember);
    }
}

// ---- Smoke (Free Fire) ----
export function initSmoke() {
    const body = document.body;
    const count = window.innerWidth < 768 ? 3 : 6;

    for (let i = 0; i < count; i++) {
        const smoke = document.createElement('div');
        smoke.className = 'smoke';
        smoke.style.left = (10 + Math.random() * 80) + '%';
        smoke.style.bottom = '0';
        smoke.style.animationDuration = (6 + Math.random() * 6) + 's';
        smoke.style.animationDelay = (Math.random() * 5) + 's';
        smoke.style.width = smoke.style.height = (50 + Math.random() * 60) + 'px';
        body.appendChild(smoke);
    }
}

// ---- Decorative Elements ----
export function initDecorations(gameType) {
    if (gameType === 'blox-fruits') {
        initWaves();
    } else if (gameType === 'grow-garden') {
        initFireflies();
        initGrass();

        // Add sun glow
        const sunGlow = document.createElement('div');
        sunGlow.className = 'sun-glow';
        document.body.appendChild(sunGlow);
    } else if (gameType === 'free-fire') {
        initEmbers();
        initSmoke();
    }
}
