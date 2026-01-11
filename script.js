// ================= CONFIGURATION =================
const PHP_CONFIG = {
    GAMES_API: 'https://games-get.wasmer.app/',
    VERIFY_PIN: 'https://pin-get.wasmer.app/',
    LOGOUT: 'https://logout-page.wasmer.app'
};

// ================= GLOBAL VARIABLES =================
let slideInterval;
let currentSlide = 1;
let totalSlides = 0;
let particles = [];
let shockwave = false;
let canvas, ctx, logo;

// ================= PIN VERIFICATION =================
async function verifyPin(pin) {
    try {
        if (!pin || pin.length !== 4 || !/^\d+$/.test(pin)) {
            return { success: false, message: 'PIN must be 4 digits' };
        }
        
        // SIMPLE GET REQUEST - like your Instagram tool
        const url = `${PHP_CONFIG.VERIFY_PIN}?pin=${pin}&_t=${Date.now()}`;
        console.log('PIN URL:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('PIN Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('PIN Result:', result);
        
        return result;
        
    } catch (error) {
        console.error('PIN error:', error);
        
        // Fallback: Check locally if server fails
        if (pin === '1516') { // CHANGE TO YOUR PIN
            return { success: true, message: 'Access granted (local)' };
        }
        
        return { 
            success: false, 
            message: 'Server error. Try again.' 
        };
    }
}

function showPinModal() {
    document.getElementById('pinInput').value = '';
    document.getElementById('pinError').textContent = '';
    document.getElementById('pinModal').classList.remove('hidden');
    setTimeout(() => document.getElementById('pinInput').focus(), 100);
}

function showError(message) {
    const pinError = document.getElementById('pinError');
    if (pinError) {
        pinError.textContent = message;
        pinError.style.color = '#ff4757';
    }
}
// ================= LOAD GAMES FROM PHP BACKEND =================
async function loadGames() {
    try {
        console.log('Loading games from:', PHP_CONFIG.GAMES_API);
        
        // SIMPLE FETCH - NO credentials needed
        const response = await fetch(PHP_CONFIG.GAMES_API, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to load games`);
        }
        
        const result = await response.json();
        console.log('Games result:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to load games');
        }
        
        // Decrypt base64 encoded links
        const games = result.games.map(game => {
            const decryptedGame = { ...game };
            
            // List of link fields to decrypt
            const linkFields = [
                'keyLink', 'gameLink', 'yuzuLink', 'gamehubLink', 
                'edenLink', 'citronLink', 'emulatorLink', 'graphicsLink',
                'firmwareLink', 'videoLink'
            ];
            
            linkFields.forEach(field => {
                if (decryptedGame[field] && decryptedGame[field] !== '#') {
                    try {
                        // Simple one-time decode
                        decryptedGame[field] = atob(decryptedGame[field]);
                    } catch (e) {
                        console.warn(`Failed to decrypt ${field}:`, e);
                        decryptedGame[field] = '#';
                    }
                }
            });
            
            return decryptedGame;
        });
        
        // Store games globally
        window.gamesData = games;
        
        // Render games
        renderGames(games);
        
        console.log('Games loaded successfully:', games.length);
        return games;
        
    } catch (error) {
        console.error('Error loading games:', error);
        alert('Error: ' + error.message);
        return [];
    }
}
// ================= GAME LIBRARY SYSTEM =================
function renderGames(games) {
    const gamesContainer = document.querySelector('.games');
    if (!gamesContainer) return;
    
    gamesContainer.innerHTML = '';
    
    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-category', game.category);
        card.setAttribute('data-game-id', game.id);
        
        card.innerHTML = `
            <img src="${game.image}" alt="${game.name}" loading="lazy">
            <h3>${game.name}</h3>
        `;
        
        card.addEventListener('click', () => openGameModal(game));
        gamesContainer.appendChild(card);
    });
}

function searchGames() {
    const input = document.getElementById("search").value.toLowerCase();
    const cards = document.querySelectorAll(".card");
    
    cards.forEach(card => {
        if (card.innerText.toLowerCase().includes(input)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

function filterGames(category) {
    document.querySelectorAll(".card").forEach(card => {
        if (category === "all" || card.dataset.category === category) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

// ================= ENTER LIBRARY AFTER PIN =================
async function handlePinAccess(pin) {
    const result = await verifyPin(pin);
    
    if (result.success) {
        // Hide PIN modal
        document.getElementById('pinModal').classList.add('hidden');
        
        // Show library
        document.querySelector(".header").style.display = "none";
        document.getElementById('library').classList.remove("hidden");
        document.getElementById('logoutBtn').classList.remove('hidden');
        
        // Load games from PHP
        await loadGames();
        
        // Remember PIN if checkbox checked
        if (document.getElementById('rememberPin').checked) {
            localStorage.setItem('pinSession', 'active');
            localStorage.setItem('lastAccess', Date.now());
        }
        
        return true;
    } else {
        showError(result.message || 'Invalid PIN');
        return false;
    }
}

// ================= GAME DETAILS MODAL =================
function openGameModal(game) {
    // Update modal content
    document.getElementById('modalGameImage').src = game.image;
    document.getElementById('modalGameName').textContent = game.name;
    document.getElementById('modalGameDescription').textContent = game.description;
    document.getElementById('modalFileSize').textContent = game.size;
    document.getElementById('modalVersion').textContent = game.version;
    document.getElementById('modalRam').textContent = game.ram;
    document.getElementById('modalCategory').textContent = game.category.toUpperCase();
    
    // Clear and create buttons
    const buttonsContainer = document.getElementById('modalButtons');
    buttonsContainer.innerHTML = '';
    
    // VIDEO BUTTON
    if (game.videoLink && game.videoLink !== '#') {
        const videoBtn = document.createElement('button');
        videoBtn.className = 'download-btn btn-purple';
        videoBtn.innerHTML = '🎬 TAZAMA MAELEKEZO 🎬';
        videoBtn.onclick = () => {
            if (game.videoLink && game.videoLink !== '#') {
                window.open(game.videoLink, '_blank');
            } else {
                alert(`Hakuna video ya ${game.name} inapatikana.`);
            }
        };
        buttonsContainer.appendChild(videoBtn);
    }
    
    // GAME DATA BUTTON (Main download)
    if (game.gameLink && game.gameLink !== '#') {
        const gameBtn = document.createElement('button');
        gameBtn.className = 'download-btn btn-orange';
        gameBtn.innerHTML = '🎮 Download Game ';
        gameBtn.onclick = () => window.open(game.gameLink, '_blank');
        buttonsContainer.appendChild(gameBtn);
    }
    
    // Optional buttons - check each link
    const optionalButtons = [
        { key: 'driversLink', text: ' Driver', color: 'btn-green' },
        { key: 'saveDataLink', text: 'Save Data', color: 'btn-green' },
        { key: 'emulatorLink', text: 'Emulator', color: 'btn-gray' },
        { key: 'keyLink', text: 'KEY', color: 'btn-green' },
        { key: 'yuzuLink', text: 'Yuzu Emulator', color: 'btn-green' },
        { key: 'edenLink', text: 'Eden Emulator', color: 'btn-green' },
        { key: 'citronLink', text: 'Citron Emulator', color: 'btn-green' },
        { key: 'gamehubLink', text: 'GameHub Emulator', color: 'btn-green' },
        { key: 'winlatorLink', text: 'WinLator Emulator', color: 'btn-green' },
        { key: 'cemuLink', text: 'Cemu Emulator', color: 'btn-green' },
        { key: 'obbLink', text: 'Download Obb', color: 'btn-green' },
        { key: 'firmwareLink', text: 'Firmware', color: 'btn-green' },
        { key: 'graphicsLink', text: 'Graphics', color: 'btn-blue' }
    ];
    
    optionalButtons.forEach(btn => {
        if (game[btn.key] && game[btn.key] !== '#' && game[btn.key] !== '') {
            const button = document.createElement('button');
            button.className = `download-btn ${btn.color}`;
            button.textContent = btn.text;
            button.onclick = () => window.open(game[btn.key], '_blank');
            buttonsContainer.appendChild(button);
        }
    });
    
    // Show modal
    document.getElementById('gameModal').classList.remove('hidden');
}

function closeGameModal() {
    document.getElementById('gameModal').classList.add('hidden');
}

// ================= SLIDER SYSTEM =================
function initSlider() {
    const slider = document.querySelector('.slider:not([style*="display: none"]):not(.initialized)');
    if (!slider) return;
    
    slider.classList.add('initialized');
    const slidesContainer = slider.querySelector(".slides");
    if (!slidesContainer) return;
    
    const slides = slidesContainer.querySelectorAll("img");
    totalSlides = slides.length;

    if (slideInterval) {
        clearInterval(slideInterval);
        slideInterval = null;
    }

    const hasClones = slidesContainer.children.length > totalSlides;
    if (!hasClones && slides.length > 0) {
        const firstClone = slides[0].cloneNode(true);
        const lastClone = slides[slides.length - 1].cloneNode(true);
        
        firstClone.classList.add('slide-clone');
        lastClone.classList.add('slide-clone');
        
        slidesContainer.appendChild(firstClone);
        slidesContainer.insertBefore(lastClone, slides[0]);
        
        currentSlide = 1;
        slidesContainer.style.transform = `translateX(-${currentSlide * 100}%)`;
    }

    const prevBtn = slider.querySelector(".prev");
    const nextBtn = slider.querySelector(".next");

    function moveToSlide(index) {
        if (!slidesContainer) return;
        slidesContainer.style.transition = "transform 0.5s ease-in-out";
        slidesContainer.style.transform = `translateX(-${index * 100}%)`;
        currentSlide = index;
    }

    slideInterval = setInterval(() => moveToSlide(currentSlide + 1), 4000);

    slidesContainer.addEventListener("transitionend", function handleTransition() {
        if (currentSlide === 0) {
            slidesContainer.style.transition = "none";
            currentSlide = totalSlides;
            slidesContainer.style.transform = `translateX(-${currentSlide * 100}%)`;
        }
        if (currentSlide === totalSlides + 1) {
            slidesContainer.style.transition = "none";
            currentSlide = 1;
            slidesContainer.style.transform = `translateX(-${currentSlide * 100}%)`;
        }
    });

    function resetInterval() {
        if (slideInterval) clearInterval(slideInterval);
        slideInterval = setInterval(() => moveToSlide(currentSlide + 1), 4000);
    }

    if (nextBtn) {
        const newNextBtn = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
        newNextBtn.addEventListener("click", () => {
            moveToSlide(currentSlide + 1);
            resetInterval();
        });
    }

    if (prevBtn) {
        const newPrevBtn = prevBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
        newPrevBtn.addEventListener("click", () => {
            moveToSlide(currentSlide - 1);
            resetInterval();
        });
    }
}

// ================= PARTICLES SYSTEM =================
function initParticles() {
    canvas = document.getElementById("particles");
    if (!canvas) return;
    
    ctx = canvas.getContext("2d");
    logo = document.getElementById("logo");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 14000);
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }

    window.addEventListener("resize", () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        particles = [];
        const count = Math.floor((canvas.width * canvas.height) / 14000);
        for (let i = 0; i < count; i++) {
            particles.push(new Particle());
        }
    });

    animate();
}

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.speedY = Math.random() * 0.4 - 0.2;
    }

    update(logoPos) {
        this.x += this.speedX;
        this.y += this.speedY;

        const dx = this.x - logoPos.x;
        const dy = this.y - logoPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        let force = shockwave ? 6 : 1.2;

        if (distance < 150) {
            this.x += (dx / distance) * force;
            this.y += (dy / distance) * force;
        }

        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    }

    draw(logoPos) {
        const dx = this.x - logoPos.x;
        const dy = this.y - logoPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const opacity = distance < 150 ? 1 : 0.6;

        ctx.fillStyle = `rgba(0,242,255,${opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function getLogoPosition() {
    if (!logo) return { x: 0, y: 0 };
    const rect = logo.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
}

function animate() {
    if (!ctx || !canvas) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const logoPos = getLogoPosition();

    particles.forEach(p => {
        p.update(logoPos);
        p.draw(logoPos);
    });

    requestAnimationFrame(animate);
}

// ================= LOGO EFFECTS =================
function triggerLogo() {
    const logo = document.getElementById('logo');
    if (!logo) return;
    
    logo.classList.add("active");
    shockwave = true;

    const shockwaveEl = document.createElement('div');
    shockwaveEl.style.cssText = `
        position: fixed;
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(0,242,255,0.5) 0%, transparent 70%);
        pointer-events: none;
        z-index: 9999;
        animation: expand 0.8s ease-out forwards;
    `;
    
    const style = document.createElement('style');
    style.textContent = `@keyframes expand {0% {transform:scale(0);opacity:1}100%{transform:scale(10);opacity:0}}`;
    document.head.appendChild(style);
    
    const rect = logo.getBoundingClientRect();
    shockwaveEl.style.left = (rect.left + rect.width/2 - 50) + 'px';
    shockwaveEl.style.top = (rect.top + rect.height/2 - 50) + 'px';
    
    document.body.appendChild(shockwaveEl);
    setTimeout(() => {
        shockwaveEl.remove();
        style.remove();
    }, 800);
    
    setTimeout(() => {
        logo.classList.remove("active");
        shockwave = false;
    }, 500);
}

// ================= ACCESS BUTTON HANDLER =================
function setupPinHandler() {
    const accessBtn = document.getElementById('accessBtn');
    const pinInput = document.getElementById('pinInput');
    
    if (!accessBtn || !pinInput) return;
    
    accessBtn.addEventListener('click', async function() {
        const enteredPIN = pinInput.value.trim();
        
        if (!enteredPIN) {
            showError('Please enter PIN');
            return;
        }
        
        // Show loading state
        const originalText = this.textContent;
        this.textContent = 'Verifying...';
        this.disabled = true;
        
        const success = await handlePinAccess(enteredPIN);
        
        if (!success) {
            pinInput.value = '';
            pinInput.focus();
        }
        
        // Restore button
        this.textContent = originalText;
        this.disabled = false;
    });
    
    // Enter key support
    pinInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            accessBtn.click();
        }
    });
    
    // Auto-numeric input
    pinInput.addEventListener('input', function(e) {
        this.value = this.value.replace(/\D/g, '');
    });
}

// ================= LOADING ANIMATION =================
function initLoadingAnimation() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (!loadingScreen) return;
    
    simulateLoading();
}

function simulateLoading() {
    let progress = 0;
    const progressBar = document.querySelector('.progress-bar');
    const loadingText = document.querySelector('.loading-subtext');
    const loadingMessages = [
        "Loading Ultimate Gaming Experience...",
        "Initializing Game Library...",
        "Preparing Cybergames Interface...",
        "Almost Ready..."
    ];
    
    const interval = setInterval(() => {
        progress += Math.random() * 10 + 5;
        
        if (progress > 100) {
            progress = 100;
            clearInterval(interval);
            
            if (loadingText) {
                loadingText.textContent = "Welcome to Wolf Gaming Hub!";
                loadingText.style.color = "#00f2ff";
            }
            
            setTimeout(() => {
                hideLoadingScreen();
            }, 800);
        }
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (loadingText && progress < 100) {
            if (progress > 25 && progress < 50) {
                loadingText.textContent = loadingMessages[1];
            } else if (progress > 50 && progress < 75) {
                loadingText.textContent = loadingMessages[2];
            } else if (progress > 75) {
                loadingText.textContent = loadingMessages[3];
            }
        }
    }, 300);
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    
    loadingScreen.style.opacity = '0';
    loadingScreen.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        document.querySelector(".header").style.display = "block";
    }, 500);
}

// ================= LOGOUT =================
function logout() {
    // Call PHP logout to destroy session
    fetch(PHP_CONFIG.LOGOUT, {
        credentials: 'include'
    }).then(() => {
        // Clear local storage
        localStorage.removeItem('pinSession');
        localStorage.removeItem('lastAccess');
        
        // Reset UI
        const clonedSlider = document.getElementById('slider-clone');
        if (clonedSlider) clonedSlider.remove();
        
        const originalSlider = document.querySelector('.slider');
        if (originalSlider) {
            originalSlider.style.display = 'block';
            originalSlider.classList.remove('initialized');
        }
        
        document.querySelector(".header").style.display = "block";
        document.getElementById('library').classList.add("hidden");
        document.getElementById('logoutBtn').classList.add('hidden');
        
        // Reset slider
        setTimeout(() => {
            if (typeof initSlider === 'function') {
                if (slideInterval) {
                    clearInterval(slideInterval);
                    slideInterval = null;
                }
                initSlider();
            }
        }, 100);
    });
}

// ================= CHECK REMEMBERED PIN =================
function checkRememberedPin() {
    const pinSession = localStorage.getItem('pinSession');
    const lastAccess = localStorage.getItem('lastAccess');
    
    if (pinSession === 'active' && lastAccess) {
        const hoursSinceLastAccess = (Date.now() - parseInt(lastAccess)) / (1000 * 60 * 60);
        
        // Auto-login if within 24 hours
        if (hoursSinceLastAccess < 24) {
            // Automatically enter library
            document.querySelector(".header").style.display = "none";
            document.getElementById('library').classList.remove("hidden");
            document.getElementById('logoutBtn').classList.remove('hidden');
            
            // Load games
            loadGames();
            return true;
        } else {
            // Session expired
            localStorage.removeItem('pinSession');
            localStorage.removeItem('lastAccess');
        }
    }
    return false;
}

// ================= MAIN INITIALIZATION =================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Wolf Gaming Hub - Loading...");
    
    // Check if user has remembered PIN session
    const hasSession = checkRememberedPin();
    
    if (!hasSession) {
        // Show header if no session
        document.querySelector(".header").style.display = "block";
    }
    
    // Modal close handlers
    document.getElementById('gameModal').addEventListener('click', function(e) {
        if (e.target === this) closeGameModal();
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeGameModal();
    });
    
    // Start loading animation
    initLoadingAnimation();
    
    // Initialize components
    initSlider();
    initParticles();
    
    // Setup PIN handler
    setupPinHandler();
    
    // Setup logo click effect
    const logo = document.getElementById('logo');
    if (logo) {
        logo.addEventListener('click', triggerLogo);
    }
    
    console.log("✅ System ready with PHP backend security");
});

// ================= SHAKE ANIMATION =================
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);
