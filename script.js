// ================= CONFIGURATION =================
const PHP_CONFIG = {
    GAMES_API: 'https://get-games.wasmer.app',
    VERIFY_PIN: 'https://pin-wolft31.wasmer.app',
    LOGOUT: 'https://logout-page.wasmer.app'
};

// ================= DATA FETCHING =================
async function fetchData(url, params = {}) {
    try {
        // Build URL with parameters
        const urlParams = new URLSearchParams(params);
        const fullUrl = `${url}?${urlParams.toString()}&_t=${Date.now()}`;
        
        console.log('Fetching from:', fullUrl);
        
        // Fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(fullUrl, {
            signal: controller.signal,
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Response:', data);
        return data;
        
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

// ================= PIN VERIFICATION =================
async function verifyPin(pin) {
    try {
        const result = await fetchData(PHP_CONFIG.VERIFY_PIN, { pin: pin });
        return result;
    } catch (error) {
        return { 
            success: false, 
            message: 'Server error. Using default PIN check.' 
        };
    }
}

function showPinModal() {
    document.getElementById('pinModal').classList.remove('hidden');
}

function showError(message) {
    const pinError = document.getElementById('pinError');
    if (pinError) {
        pinError.textContent = message;
        pinError.style.color = '#ff4757';
    }
}

// ================= LOAD GAMES FROM PHP =================
async function loadGames() {
    try {
        console.log('Fetching games from PHP...');
        
        const result = await fetchData(PHP_CONFIG.GAMES_API);
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to load games');
        }
        
        // Decrypt base64 links
        const games = result.games.map(game => {
            const decryptedGame = { ...game };
            const linkFields = [
                'keyLink', 'gameLink', 'yuzuLink', 'gamehubLink', 
                'edenLink', 'citronLink', 'emulatorLink', 'graphicsLink',
                'firmwareLink', 'videoLink'
            ];
            
            linkFields.forEach(field => {
                if (decryptedGame[field] && decryptedGame[field] !== '#') {
                    try {
                        // Try to decode
                        let decoded = atob(decryptedGame[field]);
                        
                        // If result is still base64, decode again
                        if (decoded.includes('base64') || !decoded.startsWith('http')) {
                            try {
                                decoded = atob(decoded);
                            } catch (e) {
                                // Not double encoded
                            }
                        }
                        
                        if (decoded.startsWith('http')) {
                            decryptedGame[field] = decoded;
                        }
                    } catch (e) {
                        console.warn(`Decode failed for ${field}:`, e);
                        decryptedGame[field] = '#';
                    }
                }
            });
            
            return decryptedGame;
        });
        
        window.gamesData = games;
        renderGames(games);
        
        // Save games to localStorage as backup
        localStorage.setItem('cached_games', JSON.stringify(games));
        localStorage.setItem('games_cache_time', Date.now());
        
        return games;
        
    } catch (error) {
        console.error('Games error:', error);
        
        // Try to load from cache
        const cached = localStorage.getItem('cached_games');
        const cacheTime = localStorage.getItem('games_cache_time');
        
        if (cached && cacheTime && (Date.now() - cacheTime < 3600000)) {
            console.log('Using cached games');
            const games = JSON.parse(cached);
            window.gamesData = games;
            renderGames(games);
            return games;
        }
        
        alert('Error loading games. Please check your connection.');
        return [];
    }
}

// ================= RENDER GAMES =================
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
        card.style.display = card.innerText.toLowerCase().includes(input) ? "block" : "none";
    });
}

function filterGames(category) {
    document.querySelectorAll(".card").forEach(card => {
        card.style.display = (category === "all" || card.dataset.category === category) ? "block" : "none";
    });
}

// ================= ENTER LIBRARY =================
async function handlePinAccess(pin) {
    const result = await verifyPin(pin);
    
    if (result.success) {
        document.getElementById('pinModal').classList.add('hidden');
        document.querySelector(".header").style.display = "none";
        document.getElementById('library').classList.remove("hidden");
        document.getElementById('logoutBtn').classList.remove('hidden');
        
        await loadGames();
        
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

// ================= GAME MODAL =================
function openGameModal(game) {
    document.getElementById('modalGameImage').src = game.image;
    document.getElementById('modalGameName').textContent = game.name;
    document.getElementById('modalGameDescription').textContent = game.description;
    document.getElementById('modalFileSize').textContent = game.size;
    document.getElementById('modalVersion').textContent = game.version || 'null';
    document.getElementById('modalRam').textContent = game.ram || '4GB+';
    document.getElementById('modalCategory').textContent = game.category.toUpperCase();
    
    const buttonsContainer = document.getElementById('modalButtons');
    buttonsContainer.innerHTML = '';
    
    if (game.videoLink && game.videoLink !== '#') {
        const videoBtn = document.createElement('button');
        videoBtn.className = 'download-btn btn-purple';
        videoBtn.innerHTML = '🎬 TAZAMA MAELEKEZO 🎬';
        videoBtn.onclick = () => window.open(game.videoLink, '_blank');
        buttonsContainer.appendChild(videoBtn);
    }
    
    if (game.gameLink && game.gameLink !== '#') {
        const gameBtn = document.createElement('button');
        gameBtn.className = 'download-btn btn-orange';
        gameBtn.innerHTML = '🎮 Download Game ';
        gameBtn.onclick = () => window.open(game.gameLink, '_blank');
        buttonsContainer.appendChild(gameBtn);
    }
    
    const optionalButtons = [
        { key: 'driversLink', text: 'Driver', color: 'btn-green' },
        { key: 'saveDataLink', text: 'Save Data', color: 'btn-green' },
        { key: 'emulatorLink', text: 'Emulator', color: 'btn-gray' },
        { key: 'keyLink', text: 'KEY', color: 'btn-green' },
        { key: 'yuzuLink', text: 'Yuzu', color: 'btn-green' },
        { key: 'edenLink', text: 'Eden', color: 'btn-green' },
        { key: 'citronLink', text: 'Citron', color: 'btn-green' },
        { key: 'gamehubLink', text: 'GameHub', color: 'btn-green' },
        { key: 'graphicsLink', text: 'Graphics', color: 'btn-blue' },
        { key: 'firmwareLink', text: 'Firmware', color: 'btn-green' }
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
    
    document.getElementById('gameModal').classList.remove('hidden');
}

function closeGameModal() {
    document.getElementById('gameModal').classList.add('hidden');
}

// ================= SLIDER =================
function initSlider() {
    const slider = document.querySelector('.slider:not([style*="display: none"]):not(.initialized)');
    if (!slider) return;
    
    slider.classList.add('initialized');
    const slidesContainer = slider.querySelector(".slides");
    if (!slidesContainer) return;
    
    const slides = slidesContainer.querySelectorAll("img");
    totalSlides = slides.length;

    if (slideInterval) clearInterval(slideInterval);

    const hasClones = slidesContainer.children.length > totalSlides;
    if (!hasClones && slides.length > 0) {
        const firstClone = slides[0].cloneNode(true);
        const lastClone = slides[slides.length - 1].cloneNode(true);
        
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

    slidesContainer.addEventListener("transitionend", function() {
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
        nextBtn.addEventListener("click", () => {
            moveToSlide(currentSlide + 1);
            resetInterval();
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            moveToSlide(currentSlide - 1);
            resetInterval();
        });
    }
}

// ================= PARTICLES =================
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

// ================= LOGO EFFECT =================
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

// ================= PIN HANDLER =================
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
        
        const originalText = this.textContent;
        this.textContent = 'Verifying...';
        this.disabled = true;
        
        const success = await handlePinAccess(enteredPIN);
        
        if (!success) {
            pinInput.value = '';
            pinInput.focus();
        }
        
        this.textContent = originalText;
        this.disabled = false;
    });
    
    pinInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') accessBtn.click();
    });
    
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
    // Clear all local storage
    localStorage.removeItem('pinSession');
    localStorage.removeItem('lastAccess');
    localStorage.removeItem('pin_verified');
    localStorage.removeItem('pin_time');
    localStorage.removeItem('cached_games');
    localStorage.removeItem('games_cache_time');
    
    document.querySelector(".header").style.display = "block";
    document.getElementById('library').classList.add("hidden");
    document.getElementById('logoutBtn').classList.add('hidden');
    
    if (slideInterval) {
        clearInterval(slideInterval);
        slideInterval = null;
    }
    initSlider();
}

// ================= CHECK REMEMBERED PIN =================
function checkRememberedPin() {
    const pinSession = localStorage.getItem('pinSession');
    const lastAccess = localStorage.getItem('lastAccess');
    
    if (pinSession === 'active' && lastAccess) {
        const hoursSinceLastAccess = (Date.now() - parseInt(lastAccess)) / (1000 * 60 * 60);
        
        if (hoursSinceLastAccess < 24) {
            document.querySelector(".header").style.display = "none";
            document.getElementById('library').classList.remove("hidden");
            document.getElementById('logoutBtn').classList.remove('hidden');
            
            loadGames();
            return true;
        } else {
            localStorage.removeItem('pinSession');
            localStorage.removeItem('lastAccess');
        }
    }
    return false;
}

// ================= DEBUG: TEST PHP ENDPOINTS =================
function testEndpoints() {
    console.log('Testing PHP endpoints:');
    console.log('1. Verify PIN:', PHP_CONFIG.VERIFY_PIN);
    console.log('2. Get Games:', PHP_CONFIG.GAMES_API);
    console.log('3. Logout:', PHP_CONFIG.LOGOUT);
    
    // Test games endpoint
    fetch(PHP_CONFIG.GAMES_API)
        .then(r => {
            console.log('Games endpoint status:', r.status);
            return r.text();
        })
        .then(text => {
            console.log('Games response sample:', text.substring(0, 100));
        })
        .catch(err => console.log('Games test failed:', err));
}

// ================= MAIN INITIALIZATION =================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Wolf Gaming Hub - Initializing...");
    
    // Test endpoints
    testEndpoints();
    
    const hasSession = checkRememberedPin();
    
    if (!hasSession) {
        document.querySelector(".header").style.display = "block";
    }
    
    document.getElementById('gameModal').addEventListener('click', function(e) {
        if (e.target === this) closeGameModal();
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeGameModal();
    });
    
    initLoadingAnimation();
    initSlider();
    initParticles();
    setupPinHandler();
    
    const logo = document.getElementById('logo');
    if (logo) {
        logo.addEventListener('click', triggerLogo);
    }
    
    console.log("✅ System ready - fetching from external PHP");
});
