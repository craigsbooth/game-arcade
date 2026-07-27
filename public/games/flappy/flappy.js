// ===== FLAPPY BIRD =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 400, H = 600;
canvas.width = W; canvas.height = H;

// Constants
const GRAVITY = 0.45;
const JUMP = -7.5;
const PIPE_W = 56;
const PIPE_GAP = 145;
const PIPE_SPEED = 2.8;
const GROUND_H = 80;
const BIRD_X = 80;

// State
let bird, pipes, score, best, gameState, groundX, frameCount;
best = parseInt(localStorage.getItem('flappy-best') || '0');

// DOM
const elScore = document.getElementById('score-display');
const startMsg = document.getElementById('start-msg');
const gameOverEl = document.getElementById('game-over');
const finalScore = document.getElementById('final-score');
const bestScore = document.getElementById('best-score');
bestScore.textContent = best;

// ===== INIT =====
function reset() {
    bird = { y: H/2 - 30, vy: 0, rotation: 0, flapFrame: 0 };
    pipes = [];
    score = 0;
    groundX = 0;
    frameCount = 0;
    gameState = 'ready'; // ready, playing, dead
    elScore.textContent = '0';
    startMsg.style.display = 'block';
    gameOverEl.classList.add('hidden');
}

function flap() {
    if (gameState === 'dead') return;
    if (gameState === 'ready') {
        gameState = 'playing';
        startMsg.style.display = 'none';
    }
    bird.vy = JUMP;
    bird.flapFrame = 1;
}

function die() {
    gameState = 'dead';
    if (score > best) {
        best = score;
        localStorage.setItem('flappy-best', String(best));
    }
    finalScore.textContent = score;
    bestScore.textContent = best;
    gameOverEl.classList.remove('hidden');
}

// ===== INPUT =====
document.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flap(); }
});
canvas.addEventListener('click', flap);
canvas.addEventListener('touchstart', e => { e.preventDefault(); flap(); });
document.getElementById('retry-btn').addEventListener('click', () => { reset(); });

// ===== UPDATE =====
function update() {
    if (gameState !== 'playing') {
        // Idle bob
        if (gameState === 'ready') {
            bird.y = H/2 - 30 + Math.sin(frameCount * 0.05) * 8;
        }
        groundX = (groundX - 1) % 24;
        frameCount++;
        return;
    }

    frameCount++;

    // Bird physics
    bird.vy += GRAVITY;
    bird.y += bird.vy;
    bird.rotation = Math.min(Math.PI/4, Math.max(-Math.PI/4, bird.vy * 0.08));
    bird.flapFrame = Math.max(0, bird.flapFrame - 0.1);

    // Ground collision
    if (bird.y + 14 > H - GROUND_H) { bird.y = H - GROUND_H - 14; die(); return; }
    // Ceiling
    if (bird.y - 14 < 0) { bird.y = 14; bird.vy = 0; }

    // Ground scroll
    groundX = (groundX - PIPE_SPEED) % 24;

    // Spawn pipes
    if (frameCount % 90 === 0 || (pipes.length === 0 && frameCount > 30)) {
        const minY = 80;
        const maxY = H - GROUND_H - PIPE_GAP - 80;
        const topH = minY + Math.random() * (maxY - minY);
        pipes.push({
            x: W + 10,
            topH: topH,
            scored: false
        });
    }

    // Move pipes
    pipes.forEach(p => { p.x -= PIPE_SPEED; });
    pipes = pipes.filter(p => p.x + PIPE_W > -10);

    // Collision & scoring
    pipes.forEach(p => {
        // Score
        if (!p.scored && p.x + PIPE_W < BIRD_X) {
            p.scored = true;
            score++;
            elScore.textContent = score;
        }
        // Collision
        if (BIRD_X + 12 > p.x && BIRD_X - 12 < p.x + PIPE_W) {
            if (bird.y - 10 < p.topH || bird.y + 10 > p.topH + PIPE_GAP) {
                die();
            }
        }
    });
}

// ===== RENDERING =====
function draw() {
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
    sky.addColorStop(0, '#4ec0ca');
    sky.addColorStop(1, '#71c8d0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H - GROUND_H);

    // Clouds (parallax)
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 5; i++) {
        const cx = ((i * 120 + frameCount * 0.2) % (W + 80)) - 40;
        const cy = 60 + i * 40;
        drawCloud(cx, cy);
    }

    // Pipes
    pipes.forEach(p => drawPipe(p));

    // Ground
    ctx.fillStyle = '#ded895';
    ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
    // Ground texture
    ctx.fillStyle = '#c8b456';
    for (let x = groundX; x < W + 24; x += 24) {
        ctx.fillRect(x, H - GROUND_H, 24, 4);
    }
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(0, H - GROUND_H, W, 3);

    // Bird
    drawBird();
}

function drawPipe(p) {
    const topH = p.topH;
    const botY = topH + PIPE_GAP;
    const botH = H - GROUND_H - botY;

    // Top pipe
    const tGrad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
    tGrad.addColorStop(0, '#5cb85c');
    tGrad.addColorStop(0.3, '#73d973');
    tGrad.addColorStop(0.7, '#5cb85c');
    tGrad.addColorStop(1, '#3d8b3d');
    ctx.fillStyle = tGrad;
    ctx.fillRect(p.x, 0, PIPE_W, topH);
    // Cap
    ctx.fillStyle = '#4cae4c';
    ctx.fillRect(p.x - 4, topH - 24, PIPE_W + 8, 24);
    ctx.strokeStyle = '#2d6e2d';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 4, topH - 24, PIPE_W + 8, 24);

    // Bottom pipe
    ctx.fillStyle = tGrad;
    ctx.fillRect(p.x, botY, PIPE_W, botH);
    // Cap
    ctx.fillStyle = '#4cae4c';
    ctx.fillRect(p.x - 4, botY, PIPE_W + 8, 24);
    ctx.strokeStyle = '#2d6e2d';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x - 4, botY, PIPE_W + 8, 24);

    // Highlights
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(p.x + 4, 0, 6, topH);
    ctx.fillRect(p.x + 4, botY, 6, botH);
}

function drawBird() {
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(bird.rotation);

    // Body
    ctx.fillStyle = '#f7dc6f';
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI*2); ctx.fill();
    // Belly
    ctx.fillStyle = '#fcf3cf';
    ctx.beginPath(); ctx.ellipse(4, 4, 10, 7, 0, 0, Math.PI*2); ctx.fill();
    // Wing
    const wingY = bird.flapFrame > 0.5 ? -6 : 2;
    ctx.fillStyle = '#f0b429';
    ctx.beginPath(); ctx.ellipse(-4, wingY, 10, 6, -0.2, 0, Math.PI*2); ctx.fill();
    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(8, -4, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(9, -3, 2.5, 0, Math.PI*2); ctx.fill();
    // Beak
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(22, 2);
    ctx.lineTo(14, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

function drawCloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI*2);
    ctx.arc(x+18, y-5, 15, 0, Math.PI*2);
    ctx.arc(x+35, y, 18, 0, Math.PI*2);
    ctx.fill();
}

// ===== LOOP =====
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

reset();
loop();
