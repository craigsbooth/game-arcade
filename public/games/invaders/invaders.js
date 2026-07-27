// ===== SPACE INVADERS =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 560, H = 640;
canvas.width = W; canvas.height = H;

// State
let score = 0, wave = 1, lives = 3, gameOver = false, paused = false;
let best = parseInt(localStorage.getItem('invaders-best') || '0');
let player, bullets, enemies, enemyBullets, particles, shields;
let enemyDir = 1, enemySpeed = 0.4, enemyDropTimer = 0;
let shootCooldown = 0, enemyShootTimer = 0;
let keys = {};

// DOM
const elScore = document.getElementById('score');
const elWave = document.getElementById('wave');
const elLives = document.getElementById('lives');
const elBest = document.getElementById('best');
const overlay = document.getElementById('overlay');
elBest.textContent = best;
document.getElementById('restart-btn').addEventListener('click', newGame);

// Input
document.addEventListener('keydown', e => { keys[e.key]=true; if(e.key===' ')e.preventDefault(); });
document.addEventListener('keyup', e => { keys[e.key]=false; });
// Mobile
let mLeft=false, mRight=false, mFire=false;
const cl=document.getElementById('ctrl-left'), cr=document.getElementById('ctrl-right'), cf=document.getElementById('ctrl-fire');
cl.addEventListener('touchstart',e=>{e.preventDefault();mLeft=true;});
cl.addEventListener('touchend',e=>{e.preventDefault();mLeft=false;});
cr.addEventListener('touchstart',e=>{e.preventDefault();mRight=true;});
cr.addEventListener('touchend',e=>{e.preventDefault();mRight=false;});
cf.addEventListener('touchstart',e=>{e.preventDefault();mFire=true;});
cf.addEventListener('touchend',e=>{e.preventDefault();mFire=false;});

// ===== ENTITIES =====
function createPlayer() {
    return { x: W/2, y: H-40, w: 36, h: 20, speed: 4.5 };
}

function createEnemyGrid() {
    const rows = Math.min(5, 3 + Math.floor(wave/3));
    const cols = Math.min(11, 8 + Math.floor(wave/4));
    const grid = [];
    const types = ['squid','crab','octopus'];
    const points = [30, 20, 10];
    for (let r=0; r<rows; r++) {
        for (let c=0; c<cols; c++) {
            const typeIdx = Math.min(2, Math.floor(r * 3 / rows));
            grid.push({
                x: 60 + c * 44,
                y: 60 + r * 38,
                w: 28, h: 20,
                type: types[typeIdx],
                points: points[typeIdx],
                alive: true,
                frame: 0
            });
        }
    }
    return grid;
}

function createShields() {
    const shields = [];
    const positions = [80, 180, 280, 380, 480];
    positions.forEach(sx => {
        // Each shield is a grid of small blocks
        const blocks = [];
        for (let r=0; r<4; r++) {
            for (let c=0; c<6; c++) {
                // Skip bottom-center for arch shape
                if (r===3 && (c===2||c===3)) continue;
                blocks.push({ x: sx+c*6, y: H-120+r*6, w:6, h:6, hp:3 });
            }
        }
        shields.push(...blocks);
    });
    return shields;
}

// ===== GAME LOGIC =====
function newGame() {
    score=0; wave=1; lives=3; gameOver=false;
    elScore.textContent='0'; elWave.textContent='1'; elLives.textContent='♥♥♥';
    overlay.classList.add('hidden');
    startWave();
    requestAnimationFrame(loop);
}

function startWave() {
    player = createPlayer();
    bullets = [];
    enemyBullets = [];
    particles = [];
    enemies = createEnemyGrid();
    shields = createShields();
    enemyDir = 1;
    enemySpeed = 0.4 + wave * 0.15;
    enemyShootTimer = 0;
    elWave.textContent = wave;
}

function update() {
    if (gameOver) return;

    // Player movement
    const moveLeft = keys['ArrowLeft'] || keys['a'] || mLeft;
    const moveRight = keys['ArrowRight'] || keys['d'] || mRight;
    if (moveLeft) player.x -= player.speed;
    if (moveRight) player.x += player.speed;
    player.x = Math.max(player.w/2, Math.min(W-player.w/2, player.x));

    // Shooting
    shootCooldown = Math.max(0, shootCooldown - 1);
    if ((keys[' '] || keys['ArrowUp'] || mFire) && shootCooldown <= 0) {
        bullets.push({ x: player.x, y: player.y - 12, vy: -7 });
        shootCooldown = 15;
    }

    // Move bullets
    bullets.forEach(b => b.y += b.vy);
    bullets = bullets.filter(b => b.y > -10);

    // Move enemy bullets
    enemyBullets.forEach(b => { b.y += b.vy; });
    enemyBullets = enemyBullets.filter(b => b.y < H+10);

    // Enemy movement
    let edgeHit = false;
    const aliveEnemies = enemies.filter(e => e.alive);
    aliveEnemies.forEach(e => { e.x += enemyDir * enemySpeed; });
    aliveEnemies.forEach(e => {
        if (e.x + e.w/2 > W - 20 || e.x - e.w/2 < 20) edgeHit = true;
    });
    if (edgeHit) {
        enemyDir *= -1;
        aliveEnemies.forEach(e => { e.y += 12; });
        // Speed up slightly on each drop
        enemySpeed += 0.05;
    }

    // Animate enemies
    aliveEnemies.forEach(e => { e.frame = (e.frame + 0.02) % 2; });

    // Enemy shooting
    enemyShootTimer++;
    const shootRate = Math.max(20, 60 - wave * 5);
    if (enemyShootTimer >= shootRate && aliveEnemies.length > 0) {
        enemyShootTimer = 0;
        const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        enemyBullets.push({ x: shooter.x, y: shooter.y + 10, vy: 3 + wave * 0.3 });
    }

    // Bullet vs enemy collision
    bullets.forEach(b => {
        aliveEnemies.forEach(e => {
            if (Math.abs(b.x-e.x)<e.w/2+3 && Math.abs(b.y-e.y)<e.h/2+3) {
                e.alive = false;
                b.y = -100; // remove
                score += e.points * wave;
                elScore.textContent = score;
                spawnExplosion(e.x, e.y, getEnemyColor(e.type));
            }
        });
    });

    // Bullet vs shields
    bullets.forEach(b => {
        shields.forEach(s => {
            if (s.hp<=0) return;
            if (b.x>s.x && b.x<s.x+s.w && b.y>s.y && b.y<s.y+s.h) {
                s.hp--; b.y=-100;
            }
        });
    });
    enemyBullets.forEach(b => {
        shields.forEach(s => {
            if (s.hp<=0) return;
            if (b.x>s.x && b.x<s.x+s.w && b.y>s.y && b.y<s.y+s.h) {
                s.hp--; b.y=H+100;
            }
        });
    });

    // Enemy bullet vs player
    enemyBullets.forEach(b => {
        if (Math.abs(b.x-player.x)<player.w/2 && Math.abs(b.y-player.y)<player.h/2) {
            b.y = H+100;
            playerHit();
        }
    });

    // Enemy reaches player
    if (aliveEnemies.some(e => e.y + e.h/2 > player.y - 20)) {
        gameOver = true;
        endGame();
        return;
    }

    // Wave cleared
    if (aliveEnemies.length === 0) {
        wave++;
        startWave();
    }

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=0.1; p.life-=0.03; });

    // Speed up as enemies die
    const totalEnemies = enemies.length;
    const remaining = aliveEnemies.length;
    if (remaining > 0) {
        const speedBoost = 1 + (1 - remaining/totalEnemies) * 2;
        enemySpeed = (0.4 + wave*0.15) * speedBoost;
    }
}

function playerHit() {
    lives--;
    elLives.textContent = '♥'.repeat(lives);
    spawnExplosion(player.x, player.y, '#4ade80');
    if (lives <= 0) { gameOver=true; endGame(); }
    else { player.x = W/2; }
}

function endGame() {
    if (score > best) { best=score; localStorage.setItem('invaders-best',String(best)); elBest.textContent=best; }
    document.getElementById('overlay-sub').textContent = `Score: ${score.toLocaleString()} | Wave ${wave}`;
    overlay.classList.remove('hidden');
}

function spawnExplosion(x, y, color) {
    for (let i=0; i<10; i++) {
        particles.push({
            x, y, vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5-1,
            life:1, color
        });
    }
}

function getEnemyColor(type) {
    return type==='squid'?'#f472b6':type==='crab'?'#60a5fa':'#a78bfa';
}

// ===== RENDERING =====
function draw() {
    ctx.fillStyle = '#020810';
    ctx.fillRect(0, 0, W, H);

    // Stars background
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i=0; i<30; i++) {
        const sx = (i*137.5+wave*10)%W, sy = (i*97.3)%H;
        ctx.fillRect(sx, sy, 1, 1);
    }

    // Player ship
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 12);
    ctx.lineTo(player.x - 18, player.y + 10);
    ctx.lineTo(player.x - 8, player.y + 6);
    ctx.lineTo(player.x, player.y);
    ctx.lineTo(player.x + 8, player.y + 6);
    ctx.lineTo(player.x + 18, player.y + 10);
    ctx.closePath();
    ctx.fill();
    // Cockpit
    ctx.fillStyle = '#bbf7d0';
    ctx.beginPath(); ctx.arc(player.x, player.y - 4, 4, 0, Math.PI*2); ctx.fill();

    // Enemies
    enemies.forEach(e => {
        if (!e.alive) return;
        const color = getEnemyColor(e.type);
        const f = Math.floor(e.frame);
        drawEnemy(e.x, e.y, e.type, color, f);
    });

    // Shields
    shields.forEach(s => {
        if (s.hp <= 0) return;
        const alpha = s.hp / 3;
        ctx.fillStyle = `rgba(74, 222, 128, ${alpha * 0.7})`;
        ctx.fillRect(s.x, s.y, s.w, s.h);
    });

    // Player bullets
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 6;
    bullets.forEach(b => { ctx.fillRect(b.x-1.5, b.y-6, 3, 12); });
    ctx.shadowBlur = 0;

    // Enemy bullets
    ctx.fillStyle = '#f87171';
    ctx.shadowColor = '#f87171';
    ctx.shadowBlur = 4;
    enemyBullets.forEach(b => { ctx.fillRect(b.x-1.5, b.y-4, 3, 8); });
    ctx.shadowBlur = 0;

    // Particles
    particles.forEach(p => {
        const r = Math.max(0, 3*p.life);
        if (r<=0) return;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x-r/2, p.y-r/2, r, r);
    });
    ctx.globalAlpha = 1;
}

function drawEnemy(x, y, type, color, frame) {
    ctx.fillStyle = color;
    const s = 4; // pixel scale
    // Simple pixel art patterns for each type
    if (type === 'squid') {
        // Frame 0 / 1 with slight variation
        const pattern = frame === 0 ?
            [[0,1],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2],[3,1]] :
            [[0,0],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2],[3,0],[3,2]];
        pattern.forEach(([r,c]) => ctx.fillRect(x-6+c*s, y-8+r*s, s-1, s-1));
    } else if (type === 'crab') {
        const pattern = frame === 0 ?
            [[0,1],[0,3],[1,0],[1,1],[1,2],[1,3],[1,4],[2,0],[2,1],[2,2],[2,3],[2,4],[3,0],[3,4]] :
            [[0,0],[0,4],[1,0],[1,1],[1,2],[1,3],[1,4],[2,0],[2,1],[2,2],[2,3],[2,4],[3,1],[3,3]];
        pattern.forEach(([r,c]) => ctx.fillRect(x-10+c*s, y-8+r*s, s-1, s-1));
    } else {
        const pattern = frame === 0 ?
            [[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3],[1,4],[2,0],[2,1],[2,2],[2,3],[2,4],[3,1],[3,3]] :
            [[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3],[1,4],[2,0],[2,1],[2,2],[2,3],[2,4],[3,0],[3,4]];
        pattern.forEach(([r,c]) => ctx.fillRect(x-10+c*s, y-8+r*s, s-1, s-1));
    }
}

// ===== GAME LOOP =====
function loop() {
    if (!gameOver) update();
    draw();
    requestAnimationFrame(loop);
}

newGame();
