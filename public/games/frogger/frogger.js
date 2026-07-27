// ===== FROGGER =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const T = 40; // tile size
const COLS = 13, ROWS = 13;
canvas.width = COLS*T; canvas.height = ROWS*T;

// Row layout (bottom to top):
// 0: start (safe), 1-5: road lanes, 6: middle safe, 7-11: water lanes, 12: goal
const ROW_TYPES = ['safe','road','road','road','road','road','safe','water','water','water','water','water','goal'];

let frog, lanes, score, lives, level, gameOver, goals, tick;

function createLanes() {
    lanes = [];
    for (let r = 0; r < ROWS; r++) {
        const type = ROW_TYPES[r];
        const lane = { type, objects: [] };
        const speedMult = 1 + level * 0.15;

        if (type === 'road') {
            const dir = r % 2 === 0 ? 1 : -1;
            const speed = (0.8 + Math.random() * 0.8) * dir * speedMult;
            const count = 2 + Math.floor(Math.random() * 2);
            const gap = COLS * T / count;
            for (let i = 0; i < count; i++) {
                const w = 50 + Math.random() * 30;
                lane.objects.push({ x: i * gap + Math.random() * 40, w, speed, color: randomCarColor() });
            }
        }
        if (type === 'water') {
            const dir = r % 2 === 0 ? 1 : -1;
            const speed = (0.5 + Math.random() * 0.6) * dir * speedMult;
            const count = 2 + Math.floor(Math.random() * 2);
            const gap = COLS * T / count;
            for (let i = 0; i < count; i++) {
                const w = 60 + Math.random() * 50;
                lane.objects.push({ x: i * gap, w, speed });
            }
        }
        lanes.push(lane);
    }
}

function randomCarColor() {
    const colors = ['#e74c3c','#3498db','#f39c12','#9b59b6','#1abc9c','#e67e22','#2ecc71'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function newGame() {
    score = 0; lives = 3; level = 1; gameOver = false; tick = 0;
    goals = [false,false,false,false,false]; // 5 goal slots
    document.getElementById('score').textContent = '0';
    document.getElementById('lives').textContent = '●●●';
    document.getElementById('level').textContent = '1';
    createLanes();
    resetFrog();
}

function resetFrog() {
    frog = { x: Math.floor(COLS/2), y: 0, anim: 0, dead: false };
}

function moveFrog(dx, dy) {
    if (gameOver || frog.dead) return;
    const nx = frog.x + dx, ny = frog.y + dy;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;
    frog.x = nx; frog.y = ny; frog.anim = 1;
    if (dy > 0) { score += 10; document.getElementById('score').textContent = score; }
}

// Input
document.addEventListener('keydown', e => {
    if (e.key==='ArrowUp'||e.key==='w') { e.preventDefault(); moveFrog(0, 1); }
    if (e.key==='ArrowDown'||e.key==='s') { e.preventDefault(); moveFrog(0, -1); }
    if (e.key==='ArrowLeft'||e.key==='a') moveFrog(-1, 0);
    if (e.key==='ArrowRight'||e.key==='d') moveFrog(1, 0);
    if (gameOver && e.key==='Enter') newGame();
});
document.getElementById('mu').addEventListener('click', () => moveFrog(0, 1));
document.getElementById('md').addEventListener('click', () => moveFrog(0, -1));
document.getElementById('ml').addEventListener('click', () => moveFrog(-1, 0));
document.getElementById('mr').addEventListener('click', () => moveFrog(1, 0));

function update() {
    if (gameOver) return;
    tick++;
    frog.anim *= 0.85;

    // Move lane objects
    lanes.forEach(lane => {
        lane.objects.forEach(o => {
            o.x += o.speed;
            const maxX = COLS * T;
            if (o.speed > 0 && o.x > maxX + 20) o.x = -o.w - 10;
            if (o.speed < 0 && o.x + o.w < -20) o.x = maxX + 10;
        });
    });

    if (frog.dead) return;

    const frogPx = frog.x * T + T/2;
    const frogRow = frog.y;
    const lane = lanes[frogRow];

    // Road collision
    if (lane.type === 'road') {
        for (const o of lane.objects) {
            if (frogPx > o.x - 5 && frogPx < o.x + o.w + 5) {
                killFrog(); return;
            }
        }
    }

    // Water - must be on a log
    if (lane.type === 'water') {
        let onLog = false;
        for (const o of lane.objects) {
            if (frogPx > o.x && frogPx < o.x + o.w) {
                onLog = true;
                // Ride the log
                frog.x += o.speed / T * 0.3;
                frog.x = Math.max(0, Math.min(COLS-1, frog.x));
                break;
            }
        }
        if (!onLog) { killFrog(); return; }
    }

    // Goal reached
    if (lane.type === 'goal') {
        const slot = Math.floor(frog.x / (COLS/5));
        const goalIdx = Math.max(0, Math.min(4, slot));
        if (!goals[goalIdx]) {
            goals[goalIdx] = true;
            score += 200;
            document.getElementById('score').textContent = score;
        }
        // Check all goals filled
        if (goals.every(Boolean)) {
            level++;
            document.getElementById('level').textContent = level;
            score += 1000;
            document.getElementById('score').textContent = score;
            goals = [false,false,false,false,false];
            createLanes();
        }
        resetFrog();
    }
}

function killFrog() {
    frog.dead = true;
    lives--;
    document.getElementById('lives').textContent = '●'.repeat(Math.max(0, lives));
    setTimeout(() => {
        if (lives <= 0) {
            gameOver = true;
            showHighScores('frogger', score);
        } else {
            frog.dead = false;
            resetFrog();
        }
    }, 600);
}

// ===== RENDER =====
function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw rows (bottom to top on screen, index 0 at bottom)
    for (let r = 0; r < ROWS; r++) {
        const sy = (ROWS - 1 - r) * T; // screen y (row 0 at bottom)
        const lane = lanes[r];

        // Background
        if (lane.type === 'safe') {
            ctx.fillStyle = '#2d5a27';
            ctx.fillRect(0, sy, COLS*T, T);
            // Grass texture
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            for (let x=0;x<COLS*T;x+=8) ctx.fillRect(x,sy+T-3,2,3);
        } else if (lane.type === 'road') {
            ctx.fillStyle = '#333';
            ctx.fillRect(0, sy, COLS*T, T);
            // Road markings
            if (r === 1 || r === 5) { ctx.fillStyle='#555'; ctx.fillRect(0,sy,COLS*T,2); ctx.fillRect(0,sy+T-2,COLS*T,2); }
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            for (let x=0;x<COLS*T;x+=30) ctx.fillRect(x,sy+T/2-1,12,2);
        } else if (lane.type === 'water') {
            ctx.fillStyle = '#1a5276';
            ctx.fillRect(0, sy, COLS*T, T);
            // Water ripples
            ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth=1;
            for (let x=0;x<COLS*T;x+=16) {
                ctx.beginPath(); ctx.moveTo(x+(tick*0.3)%16,sy+T/2); ctx.lineTo(x+8+(tick*0.3)%16,sy+T/2+2); ctx.stroke();
            }
        } else if (lane.type === 'goal') {
            ctx.fillStyle = '#1a3a1a';
            ctx.fillRect(0, sy, COLS*T, T);
            // Goal slots
            const slotW = COLS*T/5;
            for (let i=0;i<5;i++) {
                ctx.fillStyle = goals[i] ? '#4ade80' : '#2d5a27';
                ctx.fillRect(i*slotW+8, sy+4, slotW-16, T-8);
                ctx.strokeStyle = '#4ade80'; ctx.lineWidth=1;
                ctx.strokeRect(i*slotW+8, sy+4, slotW-16, T-8);
                if (goals[i]) {
                    ctx.fillStyle='#166534'; ctx.font='20px sans-serif'; ctx.textAlign='center';
                    ctx.fillText('🐸', i*slotW+slotW/2, sy+T/2+6);
                }
            }
        }

        // Lane objects
        lane.objects.forEach(o => {
            if (lane.type === 'road') {
                // Car
                ctx.fillStyle = o.color;
                ctx.fillRect(o.x, sy+6, o.w, T-12);
                // Windshield
                ctx.fillStyle = 'rgba(200,230,255,0.4)';
                const windX = o.speed > 0 ? o.x+o.w-14 : o.x+4;
                ctx.fillRect(windX, sy+10, 10, T-20);
                // Wheels
                ctx.fillStyle = '#111';
                ctx.fillRect(o.x+4, sy+T-8, 8, 4);
                ctx.fillRect(o.x+o.w-12, sy+T-8, 8, 4);
                ctx.fillRect(o.x+4, sy+4, 8, 4);
                ctx.fillRect(o.x+o.w-12, sy+4, 8, 4);
            }
            if (lane.type === 'water') {
                // Log
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(o.x, sy+6, o.w, T-12);
                ctx.fillStyle = '#6b3410';
                ctx.fillRect(o.x+3, sy+10, o.w-6, 2);
                ctx.fillRect(o.x+3, sy+T-14, o.w-6, 2);
                // Log ends
                ctx.fillStyle = '#a0522d';
                ctx.beginPath(); ctx.arc(o.x+4, sy+T/2, 8, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(o.x+o.w-4, sy+T/2, 8, 0, Math.PI*2); ctx.fill();
            }
        });
    }

    // Frog
    if (!frog.dead) {
        const fx = frog.x*T + T/2;
        const fy = (ROWS-1-frog.y)*T + T/2;
        const bounce = frog.anim * -4;
        // Body
        ctx.fillStyle = '#4ade80';
        ctx.beginPath(); ctx.ellipse(fx, fy+bounce, 14, 12, 0, 0, Math.PI*2); ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(fx-5, fy-8+bounce, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx+5, fy-8+bounce, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(fx-5, fy-8+bounce, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx+5, fy-8+bounce, 2, 0, Math.PI*2); ctx.fill();
        // Legs
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(fx-14, fy+6+bounce, 8, 6);
        ctx.fillRect(fx+6, fy+6+bounce, 8, 6);
    } else {
        // Death splash
        const fx = frog.x*T+T/2, fy = (ROWS-1-frog.y)*T+T/2;
        ctx.fillStyle = '#ef4444'; ctx.font='24px sans-serif'; ctx.textAlign='center';
        ctx.fillText('💀', fx, fy+8);
    }

    // Game over
    if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#4ade80'; ctx.font = 'bold 20px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2-10);
        ctx.fillStyle = '#fff'; ctx.font = '14px Nunito';
        ctx.fillText(`Score: ${score} | Press Enter`, canvas.width/2, canvas.height/2+20);
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
newGame(); loop();
