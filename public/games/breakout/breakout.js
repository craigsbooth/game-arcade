// ===== BREAKOUT / ARKANOID =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 520, H = 620;
canvas.width = W; canvas.height = H;

const PADDLE_W = 80, PADDLE_H = 12, BALL_R = 6;
const BRICK_ROWS = 8, BRICK_COLS = 10, BRICK_W = 46, BRICK_H = 18, BRICK_PAD = 4;
const BRICK_OFFSET_X = (W - BRICK_COLS * (BRICK_W + BRICK_PAD)) / 2;
const BRICK_OFFSET_Y = 60;

const ROW_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#8b5cf6','#ec4899','#6366f1'];

let paddle, ball, bricks, score, lives, level, gameState, particles;
let mouseX = W / 2;

// DOM
const elScore = document.getElementById('score');
const elLevel = document.getElementById('level');
const elLives = document.getElementById('lives');
const overlay = document.getElementById('overlay');
document.getElementById('ov-btn').addEventListener('click', newGame);

// Input
canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (W / rect.width);
});
canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.touches[0].clientX - rect.left) * (W / rect.width);
});
canvas.addEventListener('click', () => { if (gameState === 'ready') gameState = 'playing'; });
canvas.addEventListener('touchstart', e => { e.preventDefault(); if (gameState === 'ready') gameState = 'playing'; });

// ===== GAME =====
function newGame() {
    score = 0; lives = 3; level = 1; gameState = 'ready';
    overlay.classList.add('hidden');
    elScore.textContent = '0'; elLevel.textContent = '1';
    elLives.textContent = '●●●';
    particles = [];
    createLevel();
}

function createLevel() {
    paddle = { x: W/2, y: H - 36, w: PADDLE_W };
    ball = { x: W/2, y: H - 50, vx: 3.5, vy: -4.5, speed: 5 };
    bricks = [];
    for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
            bricks.push({
                x: BRICK_OFFSET_X + c * (BRICK_W + BRICK_PAD),
                y: BRICK_OFFSET_Y + r * (BRICK_H + BRICK_PAD),
                w: BRICK_W, h: BRICK_H,
                color: ROW_COLORS[r % ROW_COLORS.length],
                hp: r < 2 ? 2 : 1, // Top 2 rows take 2 hits
                alive: true
            });
        }
    }
    gameState = 'ready';
}

function update() {
    // Paddle follows mouse
    paddle.x = Math.max(paddle.w/2, Math.min(W - paddle.w/2, mouseX));

    if (gameState === 'ready') {
        ball.x = paddle.x;
        ball.y = paddle.y - BALL_R - PADDLE_H/2 - 2;
        return;
    }
    if (gameState !== 'playing') return;

    // Ball movement
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall bounces
    if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
    if (ball.x + BALL_R > W) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

    // Ball lost
    if (ball.y > H + 20) {
        lives--;
        elLives.textContent = '●'.repeat(lives);
        if (lives <= 0) { endGame(); return; }
        gameState = 'ready';
        return;
    }

    // Paddle collision
    if (ball.vy > 0 && ball.y + BALL_R > paddle.y - PADDLE_H/2 &&
        ball.y - BALL_R < paddle.y + PADDLE_H/2 &&
        ball.x > paddle.x - paddle.w/2 - BALL_R &&
        ball.x < paddle.x + paddle.w/2 + BALL_R) {
        const hit = (ball.x - paddle.x) / (paddle.w / 2); // -1 to 1
        const angle = hit * Math.PI / 3; // max 60 degrees
        const speed = Math.sqrt(ball.vx*ball.vx + ball.vy*ball.vy);
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;
        ball.y = paddle.y - PADDLE_H/2 - BALL_R;
    }

    // Brick collision
    bricks.forEach(b => {
        if (!b.alive) return;
        if (ball.x + BALL_R > b.x && ball.x - BALL_R < b.x + b.w &&
            ball.y + BALL_R > b.y && ball.y - BALL_R < b.y + b.h) {
            b.hp--;
            if (b.hp <= 0) {
                b.alive = false;
                score += (level * 10);
                elScore.textContent = score;
                spawnParticles(b.x + b.w/2, b.y + b.h/2, b.color, 6);
            } else {
                b.color = dimColor(b.color);
            }
            // Determine bounce direction
            const overlapX = Math.min(ball.x + BALL_R - b.x, b.x + b.w - (ball.x - BALL_R));
            const overlapY = Math.min(ball.y + BALL_R - b.y, b.y + b.h - (ball.y - BALL_R));
            if (overlapX < overlapY) ball.vx *= -1;
            else ball.vy *= -1;
        }
    });

    // Level cleared
    if (bricks.every(b => !b.alive)) {
        level++;
        elLevel.textContent = level;
        ball.speed += 0.3;
        createLevel();
    }

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life-=0.03; });
}

function dimColor(hex) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgb(${Math.floor(r*0.6)},${Math.floor(g*0.6)},${Math.floor(b*0.6)})`;
}

function endGame() {
    gameState = 'dead';
    document.getElementById('ov-sub').textContent = `Score: ${score} | Level ${level}`;
    overlay.classList.remove('hidden');
    showHighScores('breakout', score);
}

function spawnParticles(x, y, color, n) {
    for(let i=0;i<n;i++) particles.push({x,y,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6-2,life:1,color});
}

// ===== RENDER =====
function draw() {
    ctx.fillStyle = '#0f0a2a';
    ctx.fillRect(0, 0, W, H);

    // Bricks
    bricks.forEach(b => {
        if (!b.alive) return;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 3);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(b.x + 2, b.y + 1, b.w - 4, 3);
    });

    // Paddle
    const pGrad = ctx.createLinearGradient(paddle.x - paddle.w/2, 0, paddle.x + paddle.w/2, 0);
    pGrad.addColorStop(0, '#f472b6');
    pGrad.addColorStop(0.5, '#fb7ebc');
    pGrad.addColorStop(1, '#f472b6');
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.roundRect(paddle.x - paddle.w/2, paddle.y - PADDLE_H/2, paddle.w, PADDLE_H, 6);
    ctx.fill();
    // Glow
    ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(paddle.x - paddle.w/2, paddle.y - PADDLE_H/2, paddle.w, PADDLE_H, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ball
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // Ball highlight
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(ball.x-2, ball.y-2, 2, 0, Math.PI*2); ctx.fill();

    // Particles
    particles.forEach(p => {
        const r = Math.max(0, 3*p.life);
        if(r<=0) return;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x-r/2, p.y-r/2, r, r);
    });
    ctx.globalAlpha = 1;

    // Ready message
    if (gameState === 'ready') {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '16px "Fredoka One"';
        ctx.textAlign = 'center';
        ctx.fillText('Click to launch', W/2, H - 80);
    }
}

// ===== LOOP =====
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

newGame();
loop();
