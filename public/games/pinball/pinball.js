// ===== PINBALL - Physics-based with Canvas =====

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const W = 400;
const H = 700;
canvas.width = W;
canvas.height = H;

// Physics constants
const GRAVITY = 0.35;
const FRICTION = 0.99;
const BOUNCE = 0.7;
const FLIPPER_POWER = 14;

// Game state
let score = 0;
let balls = 3;
let best = parseInt(localStorage.getItem('pinball-best') || '0');
let gameOver = false;
let ballInPlay = false;
let launching = false;
let launchPower = 0;

// Ball
let ball = { x: W - 30, y: H - 80, vx: 0, vy: 0, r: 8 };

// Flippers
const flipperLen = 55;
const flipperWidth = 10;
let leftFlipper = { x: 110, y: H - 60, angle: 0.4, target: 0.4, speed: 0 };
let rightFlipper = { x: W - 110, y: H - 60, angle: Math.PI - 0.4, target: Math.PI - 0.4, speed: 0 };
let leftDown = false;
let rightDown = false;

// Bumpers
const bumpers = [
    { x: 120, y: 200, r: 25, score: 100, hit: 0 },
    { x: W - 120, y: 200, r: 25, score: 100, hit: 0 },
    { x: W / 2, y: 160, r: 30, score: 150, hit: 0 },
    { x: 80, y: 320, r: 20, score: 75, hit: 0 },
    { x: W - 80, y: 320, r: 20, score: 75, hit: 0 },
    { x: W / 2 - 60, y: 280, r: 18, score: 50, hit: 0 },
    { x: W / 2 + 60, y: 280, r: 18, score: 50, hit: 0 },
];

// Slingshots (triangular bouncers)
const slings = [
    { x: 55, y: H - 180, w: 40, h: 100, side: 'left' },
    { x: W - 95, y: H - 180, w: 40, h: 100, side: 'right' }
];

// Targets (rollover lanes at top)
const targets = [
    { x: W / 2 - 60, y: 80, hit: false, score: 200 },
    { x: W / 2 - 20, y: 80, hit: false, score: 200 },
    { x: W / 2 + 20, y: 80, hit: false, score: 200 },
    { x: W / 2 + 60, y: 80, hit: false, score: 200 },
];

// Particles
let particles = [];

// DOM
const elScore = document.getElementById('score');
const elBalls = document.getElementById('balls');
const elBest = document.getElementById('best');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');

elBest.textContent = best;

// ===== INPUT =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') leftDown = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rightDown = true;
    if (e.key === ' ') { e.preventDefault(); launching = true; }
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') leftDown = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') rightDown = false;
    if (e.key === ' ') { releaseBall(); launching = false; launchPower = 0; }
});

// Touch controls
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    for (const touch of e.touches) {
        const tx = touch.clientX - rect.left;
        if (tx < W / 2) leftDown = true;
        else rightDown = true;
    }
});
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    leftDown = false;
    rightDown = false;
    if (!ballInPlay) releaseBall();
});

document.getElementById('play-again').addEventListener('click', resetGame);

// ===== GAME LOGIC =====
function resetGame() {
    score = 0;
    balls = 3;
    gameOver = false;
    overlay.classList.add('hidden');
    elScore.textContent = '0';
    elBalls.textContent = '3';
    targets.forEach(t => t.hit = false);
    resetBall();
}

function resetBall() {
    ball.x = W - 30;
    ball.y = H - 80;
    ball.vx = 0;
    ball.vy = 0;
    ballInPlay = false;
    launchPower = 0;
}

function releaseBall() {
    if (ballInPlay || gameOver) return;
    ballInPlay = true;
    ball.vy = -(8 + launchPower * 0.15);
    ball.vx = -1 + Math.random() * 2;
}

function loseBall() {
    balls--;
    elBalls.textContent = balls;
    if (balls <= 0) {
        gameOver = true;
        if (score > best) {
            best = score;
            localStorage.setItem('pinball-best', String(best));
            elBest.textContent = best;
        }
        overlayTitle.textContent = 'GAME OVER';
        overlayScore.textContent = `Final Score: ${score}`;
        overlay.classList.remove('hidden');
    } else {
        resetBall();
    }
}

function addScore(pts) {
    score += pts;
    elScore.textContent = score;
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 1,
            color
        });
    }
}

// ===== PHYSICS =====
function update() {
    if (gameOver) return;

    // Launch charge
    if (launching && !ballInPlay) {
        launchPower = Math.min(launchPower + 2, 80);
    }

    if (!ballInPlay) return;

    // Gravity
    ball.vy += GRAVITY;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;

    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall bounces
    if (ball.x - ball.r < 15) { ball.x = 15 + ball.r; ball.vx = Math.abs(ball.vx) * BOUNCE; }
    if (ball.x + ball.r > W - 15) { ball.x = W - 15 - ball.r; ball.vx = -Math.abs(ball.vx) * BOUNCE; }
    if (ball.y - ball.r < 10) { ball.y = 10 + ball.r; ball.vy = Math.abs(ball.vy) * BOUNCE; }

    // Ball lost (bottom)
    if (ball.y > H + 20) {
        loseBall();
        return;
    }

    // Bumper collisions
    bumpers.forEach(b => {
        const dx = ball.x - b.x;
        const dy = ball.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < ball.r + b.r) {
            const nx = dx / dist;
            const ny = dy / dist;
            ball.x = b.x + nx * (ball.r + b.r + 1);
            ball.y = b.y + ny * (ball.r + b.r + 1);
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            ball.vx = nx * Math.max(speed, 6) * 1.1;
            ball.vy = ny * Math.max(speed, 6) * 1.1;
            b.hit = 1;
            addScore(b.score);
            spawnParticles(b.x, b.y, '#a78bfa', 5);
        } else {
            b.hit = Math.max(0, (b.hit || 0) - 0.05);
        }
    });

    // Target rollovers
    targets.forEach(t => {
        if (t.hit) return;
        if (Math.abs(ball.x - t.x) < 15 && Math.abs(ball.y - t.y) < 12) {
            t.hit = true;
            addScore(t.score);
            spawnParticles(t.x, t.y, '#fbbf24', 4);
        }
    });
    // Check if all targets hit — bonus + reset
    if (targets.every(t => t.hit)) {
        addScore(1000);
        targets.forEach(t => t.hit = false);
        spawnParticles(W / 2, 80, '#10b981', 10);
    }

    // Slingshot collisions (simple rectangle bounce)
    slings.forEach(s => {
        if (ball.x > s.x && ball.x < s.x + s.w && ball.y > s.y && ball.y < s.y + s.h) {
            if (s.side === 'left') {
                ball.vx = Math.abs(ball.vx) + 3;
                ball.vy = -Math.abs(ball.vy) * 0.8 - 2;
            } else {
                ball.vx = -Math.abs(ball.vx) - 3;
                ball.vy = -Math.abs(ball.vy) * 0.8 - 2;
            }
            addScore(25);
            spawnParticles(ball.x, ball.y, '#f472b6', 3);
        }
    });

    // Flipper collisions
    checkFlipperCollision(leftFlipper, 'left');
    checkFlipperCollision(rightFlipper, 'right');

    // Update flippers
    leftFlipper.target = leftDown ? -0.5 : 0.4;
    rightFlipper.target = leftDown ? Math.PI + 0.5 : Math.PI - 0.4; // typo fix below
    rightFlipper.target = rightDown ? Math.PI + 0.5 : Math.PI - 0.4;

    leftFlipper.speed = (leftFlipper.target - leftFlipper.angle) * 0.3;
    leftFlipper.angle += leftFlipper.speed;
    rightFlipper.speed = (rightFlipper.target - rightFlipper.angle) * 0.3;
    rightFlipper.angle += rightFlipper.speed;

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.04;
    });
}

function checkFlipperCollision(flipper, side) {
    // Simple line-segment collision with ball
    const cos = Math.cos(flipper.angle);
    const sin = Math.sin(flipper.angle);
    const endX = flipper.x + cos * flipperLen;
    const endY = flipper.y + sin * flipperLen;

    // Distance from ball to line segment
    const dx = endX - flipper.x;
    const dy = endY - flipper.y;
    const len2 = dx * dx + dy * dy;
    let t = ((ball.x - flipper.x) * dx + (ball.y - flipper.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const nearX = flipper.x + t * dx;
    const nearY = flipper.y + t * dy;
    const distX = ball.x - nearX;
    const distY = ball.y - nearY;
    const dist = Math.sqrt(distX * distX + distY * distY);

    if (dist < ball.r + flipperWidth / 2) {
        // Push ball away
        const nx = distX / (dist || 1);
        const ny = distY / (dist || 1);
        ball.x = nearX + nx * (ball.r + flipperWidth / 2 + 1);
        ball.y = nearY + ny * (ball.r + flipperWidth / 2 + 1);

        // Apply flipper force
        const isFlipping = side === 'left' ? leftDown : rightDown;
        const power = isFlipping ? FLIPPER_POWER : 3;
        ball.vx += nx * power * 0.5;
        ball.vy = -Math.abs(ny * power);
    }
}

// ===== RENDERING =====
function draw() {
    ctx.fillStyle = '#12102a';
    ctx.fillRect(0, 0, W, H);

    // Walls
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(13, 8, W - 26, H - 8);

    // Launch lane
    ctx.fillStyle = 'rgba(167, 139, 250, 0.05)';
    ctx.fillRect(W - 45, 50, 30, H - 110);
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.15)';
    ctx.strokeRect(W - 45, 50, 30, H - 110);

    // Slingshots
    slings.forEach(s => {
        ctx.fillStyle = 'rgba(244, 114, 182, 0.15)';
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(s.x, s.y, s.w, s.h);
    });

    // Bumpers
    bumpers.forEach(b => {
        const glow = b.hit || 0;
        const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        gradient.addColorStop(0, `rgba(167, 139, 250, ${0.4 + glow * 0.6})`);
        gradient.addColorStop(1, `rgba(167, 139, 250, ${0.1 + glow * 0.3})`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + glow * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(200, 180, 255, ${0.5 + glow * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        // Score text
        ctx.fillStyle = `rgba(255,255,255,${0.5 + glow * 0.5})`;
        ctx.font = '700 11px Nunito';
        ctx.textAlign = 'center';
        ctx.fillText(b.score, b.x, b.y + 4);
    });

    // Targets
    targets.forEach(t => {
        ctx.fillStyle = t.hit ? '#10b981' : 'rgba(251, 191, 36, 0.3)';
        ctx.beginPath();
        ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = t.hit ? '#10b981' : '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
        ctx.stroke();
    });

    // Flippers
    drawFlipper(leftFlipper);
    drawFlipper(rightFlipper);

    // Ball
    if (ballInPlay || !gameOver) {
        const ballGrad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 0, ball.x, ball.y, ball.r);
        ballGrad.addColorStop(0, '#fff');
        ballGrad.addColorStop(1, '#c4b5fd');
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
        // Ball glow
        ctx.shadowColor = '#a78bfa';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Launch power indicator
    if (launching && !ballInPlay) {
        ctx.fillStyle = `rgba(167, 139, 250, ${0.5 + launchPower / 160})`;
        ctx.fillRect(W - 40, H - 50 - launchPower, 20, launchPower);
    }

    // Particles
    particles.forEach(p => {
        const r = Math.max(0, 3 * p.life);
        if (r <= 0) return;
        ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawFlipper(f) {
    const cos = Math.cos(f.angle);
    const sin = Math.sin(f.angle);
    const endX = f.x + cos * flipperLen;
    const endY = f.y + sin * flipperLen;

    ctx.strokeStyle = '#e0d4ff';
    ctx.lineWidth = flipperWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Pivot
    ctx.fillStyle = '#a78bfa';
    ctx.beginPath();
    ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
    ctx.fill();
}

// ===== GAME LOOP =====
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

resetGame();
loop();
