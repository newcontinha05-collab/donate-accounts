/**
 * device-guard.js - Blocks desktop/laptop access.
 * Only allows mobile (Android, iOS) and tablet devices.
 * Uses multiple detection methods for reliability.
 * 
 * Must be loaded BEFORE other scripts - it replaces the entire page
 * with a "mobile only" overlay if a desktop is detected.
 */

(function() {
    'use strict';

    /**
     * Detect if the current device is a desktop/laptop.
     * Returns true if the device should be BLOCKED.
     */
    function isDesktopDevice() {
        const ua = navigator.userAgent || '';
        const platform = navigator.platform || '';
        const uaData = navigator.userAgentData;

        // --- Method 1: navigator.userAgentData (modern Chrome/Edge) ---
        if (uaData) {
            // userAgentData.mobile is the most reliable signal in modern browsers
            if (!uaData.mobile) {
                return true;
            }
            return false;
        }

        // --- Method 2: User-Agent string analysis ---

        // Known mobile/tablet indicators - these ALLOW access
        const mobilePatterns = [
            /Android/i,
            /iPhone/i,
            /iPad/i,
            /iPod/i,
            /webOS/i,
            /BlackBerry/i,
            /IEMobile/i,
            /Opera Mini/i,
            /Windows Phone/i,
            /Mobile/i,
            /Tablet/i,
            /Silk/i,
            /Kindle/i,
            /CrOS.*Tablet/i,  // Chrome OS tablets
        ];

        // Known desktop OS indicators - these BLOCK access
        const desktopPatterns = [
            /Windows NT/i,      // Windows desktop (NOT "Windows Phone")
            /Macintosh/i,       // macOS desktop
            /Mac OS X(?!.*Mobile)/i, // macOS (not iOS)
            /Linux(?!.*Android)/i,   // Linux desktop (not Android)
            /CrOS(?!.*Tablet)/i,     // ChromeOS desktop (not tablet)
            /X11/i,              // Unix/X11 desktop
        ];

        // Check if it matches any mobile pattern first
        const isMobileUA = mobilePatterns.some(pattern => pattern.test(ua));
        if (isMobileUA) {
            return false; // It's a mobile/tablet - ALLOW
        }

        // Check if it matches desktop patterns
        const isDesktopUA = desktopPatterns.some(pattern => pattern.test(ua));
        if (isDesktopUA) {
            return true; // It's a desktop - BLOCK
        }

        // --- Method 3: Platform check ---
        const desktopPlatforms = [
            'Win32', 'Win64', 'Windows',
            'MacIntel', 'Macintosh',
            'Linux x86_64', 'Linux i686', 'Linux x86'
        ];

        if (desktopPlatforms.includes(platform)) {
            // Double check - could be a mobile with spoofed platform
            // If it also has touch, might be a Windows tablet or macOS with touch
            const hasTouch = ('ontouchstart' in window) || 
                             (navigator.maxTouchPoints > 0);
            
            // Windows tablets and iPads requesting desktop site have touch
            // but also desktop platforms. If screen is small + touch, allow
            if (hasTouch && Math.min(window.screen.width, window.screen.height) < 900) {
                return false; // Likely a tablet
            }

            return true; // Desktop
        }

        // --- Method 4: Touch + screen size fallback ---
        const hasTouch = ('ontouchstart' in window) || 
                         (navigator.maxTouchPoints > 0);
        
        if (!hasTouch) {
            return true; // No touch = probably desktop
        }

        // Has touch + large screen = probably desktop with touch screen
        // Tablets max out around 1366px on the shortest dimension
        const minDimension = Math.min(window.screen.width, window.screen.height);
        if (minDimension > 1024) {
            return true; // Too big for a tablet
        }

        return false; // Default: allow
    }

    /**
     * Creates and displays the desktop block overlay.
     */
    function showDesktopBlockScreen() {
        // Prevent any existing content from showing
        document.documentElement.style.overflow = 'hidden';
        
        // Create the overlay
        const overlay = document.createElement('div');
        overlay.id = 'desktop-block-overlay';
        overlay.innerHTML = `
            <div class="dbo-container">
                <div class="dbo-stars" id="dbo-stars"></div>
                
                <div class="dbo-content">
                    <div class="dbo-icon-wrap">
                        <div class="dbo-phone-icon">
                            <svg viewBox="0 0 64 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="2" y="2" width="60" height="96" rx="10" stroke="url(#phoneGrad)" stroke-width="3"/>
                                <rect x="8" y="14" width="48" height="66" rx="3" fill="rgba(255,255,255,0.08)"/>
                                <circle cx="32" cy="90" r="4" stroke="url(#phoneGrad)" stroke-width="2"/>
                                <rect x="22" y="6" width="20" height="3" rx="1.5" fill="rgba(255,255,255,0.2)"/>
                                <defs>
                                    <linearGradient id="phoneGrad" x1="0" y1="0" x2="64" y2="100">
                                        <stop offset="0%" stop-color="#FF6B35"/>
                                        <stop offset="50%" stop-color="#E31B23"/>
                                        <stop offset="100%" stop-color="#FFD700"/>
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <div class="dbo-pulse-ring"></div>
                        <div class="dbo-pulse-ring dbo-pulse-ring-2"></div>
                    </div>
                    
                    <h1 class="dbo-title">Abra no Celular</h1>
                    <p class="dbo-subtitle">
                        Este site funciona <strong>apenas em celulares e tablets</strong>.
                        Para garantir sua conta, acesse pelo navegador do seu celular! 📲
                    </p>
                    
                    <div class="dbo-divider"></div>

                    <p class="dbo-footer-note">
                        Compatível com Android e iPhone
                    </p>
                </div>

                <!-- Decorative floating shapes -->
                <div class="dbo-geo dbo-geo-1"></div>
                <div class="dbo-geo dbo-geo-2"></div>
                <div class="dbo-geo dbo-geo-3"></div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #desktop-block-overlay {
                position: fixed;
                inset: 0;
                z-index: 99999;
                overflow-y: auto;
            }

            .dbo-container {
                min-height: 100vh;
                width: 100%;
                background: linear-gradient(135deg,
                    #0a0a1a 0%,
                    #1a1a3e 25%,
                    #16213e 50%,
                    #0f3460 75%,
                    #1a1a3e 100%
                );
                background-size: 400% 400%;
                animation: dboBgShift 15s ease infinite;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Poppins', 'Segoe UI', -apple-system, sans-serif;
                color: #fff;
                padding: 40px 20px;
                position: relative;
                overflow: hidden;
            }

            @keyframes dboBgShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }

            .dbo-stars {
                position: absolute;
                inset: 0;
                pointer-events: none;
            }

            .dbo-star {
                position: absolute;
                width: 2px;
                height: 2px;
                background: white;
                border-radius: 50%;
                animation: dboStarTwinkle 3s ease-in-out infinite;
            }

            @keyframes dboStarTwinkle {
                0%, 100% { opacity: 0.2; }
                50% { opacity: 0.9; }
            }

            .dbo-content {
                position: relative;
                z-index: 10;
                max-width: 480px;
                width: 100%;
                text-align: center;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 20px;
            }

            /* Phone Icon */
            .dbo-icon-wrap {
                position: relative;
                width: 100px;
                height: 140px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 8px;
            }

            .dbo-phone-icon {
                width: 64px;
                height: 100px;
                animation: dboPhoneBob 3s ease-in-out infinite;
                filter: drop-shadow(0 8px 25px rgba(255, 107, 53, 0.3));
            }

            @keyframes dboPhoneBob {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                25% { transform: translateY(-8px) rotate(2deg); }
                75% { transform: translateY(-4px) rotate(-1deg); }
            }

            .dbo-pulse-ring {
                position: absolute;
                width: 120px;
                height: 120px;
                border: 2px solid rgba(255, 107, 53, 0.3);
                border-radius: 50%;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.5);
                animation: dboPulse 3s ease-out infinite;
            }

            .dbo-pulse-ring-2 {
                animation-delay: 1.5s;
            }

            @keyframes dboPulse {
                0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.8; }
                100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
            }

            /* Title */
            .dbo-title {
                font-family: 'Fredoka One', 'Poppins', cursive;
                font-size: 2.4rem;
                background: linear-gradient(135deg, #FF6B35, #E31B23, #FFD700);
                background-size: 300% 300%;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                animation: dboTextGrad 4s ease infinite;
                line-height: 1.2;
                margin: 0;
            }

            @keyframes dboTextGrad {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }

            .dbo-subtitle {
                font-size: 1.05rem;
                opacity: 0.8;
                line-height: 1.6;
                margin: 0;
                max-width: 380px;
            }

            /* Divider */
            .dbo-divider {
                width: 60px;
                height: 3px;
                background: linear-gradient(90deg, #FF6B35, #FFD700);
                border-radius: 2px;
                opacity: 0.6;
            }

            .dbo-subtitle strong {
                color: #FFD700;
            }


            /* Footer */
            .dbo-footer-note {
                font-size: 0.82rem;
                opacity: 0.35;
                margin: 0;
            }

            /* Decorative geo shapes */
            .dbo-geo {
                position: absolute;
                pointer-events: none;
                opacity: 0.04;
                border: 3px solid;
            }

            .dbo-geo-1 {
                width: 180px;
                height: 180px;
                border-color: #FF6B35;
                border-radius: 30%;
                top: 8%;
                left: 5%;
                animation: dboGeoRotate 20s linear infinite;
            }

            .dbo-geo-2 {
                width: 140px;
                height: 140px;
                border-color: #FFD700;
                bottom: 10%;
                right: 5%;
                animation: dboGeoRotate 25s linear infinite reverse;
            }

            .dbo-geo-3 {
                width: 100px;
                height: 100px;
                border-color: #E31B23;
                border-radius: 50%;
                top: 60%;
                left: 8%;
                animation: dboGeoFloat 6s ease-in-out infinite;
            }

            @keyframes dboGeoRotate {
                to { transform: rotate(360deg); }
            }

            @keyframes dboGeoFloat {
                0%, 100% { transform: translateY(0) scale(1); }
                50% { transform: translateY(-20px) scale(1.1); }
            }

            /* Hide EVERYTHING behind the overlay */
            #desktop-block-overlay ~ * {
                display: none !important;
            }
        `;

        // Inject into the page as early as possible
        document.head.appendChild(style);

        // Wait for body to be ready
        if (document.body) {
            document.body.insertBefore(overlay, document.body.firstChild);
            initBlockScreen();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.insertBefore(overlay, document.body.firstChild);
                initBlockScreen();
            });
        }

        // Hide all other body children
        function hideContent() {
            const children = document.body.children;
            for (let i = 0; i < children.length; i++) {
                if (children[i].id !== 'desktop-block-overlay') {
                    children[i].style.display = 'none';
                }
            }
        }

        if (document.body) {
            hideContent();
        }
        document.addEventListener('DOMContentLoaded', hideContent);
    }

    /**
     * Initialize interactive elements on the block screen.
     */
    function initBlockScreen() {
        // Generate stars
        const starsContainer = document.getElementById('dbo-stars');
        if (starsContainer) {
            for (let i = 0; i < 60; i++) {
                const star = document.createElement('div');
                star.className = 'dbo-star';
                star.style.left = Math.random() * 100 + '%';
                star.style.top = Math.random() * 100 + '%';
                star.style.animationDelay = (Math.random() * 3) + 's';
                star.style.animationDuration = (2 + Math.random() * 3) + 's';
                star.style.width = star.style.height = (1 + Math.random() * 2) + 'px';
                starsContainer.appendChild(star);
            }
        }
    }

    // --- Run the check immediately ---
    if (isDesktopDevice()) {
        showDesktopBlockScreen();
    }

})();
