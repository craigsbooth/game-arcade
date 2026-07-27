// ===== KART RACING - Pseudo 3D =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 640, H = 400;
canvas.width = W; canvas.height = H;

// Track definition (sequence of segments with curves)
const TRACK_LENGTH = 3000;
const SEGMENT_LENGTH = 5;
const segments = [];
const ROAD_W = 1200;
const LANES = 3;

// Build track with curves and hills
function buildTrack() {
    for (let i = 0; i < TRACK_LENGTH; i++) {
        let curve = 0, hill = 0;
        // Curves
        if (i > 100 && i < 250) curve = 0.4;
        if (i > 400 && i < 500) curve = -0.6;
        if (i > 600 && i < 800) curve = 0.3;
        if (i > 900 && i < 1050) curve = -0.5;
        if (i > 1200 && i < 1400) curve = 0.7;
        if (i > 1600 && i < 1750) curve = -0.4;
        if (i > 2000 && i < 2200) curve = 0.5;
        if (i > 2500 && i < 2700) curve = -0.6;
        // Hills
        if (i > 150 && i < 200) hill = 20;
        if (i > 500 && i < 550) hill = -15;
        if (i > 1000 && i < 1080) hill = 25;
        if (i > 1800 && i < 1860) hill = -20;
        if (i > 2300 && i < 2380) hill = 18;
        
        segments.push({ curve, y: hill, color: i % 2 === 0 });
    }
}
buildTrack();

// Player
let player = { pos: 0, x: 0, speed: 0, lap: 1, steer: 0 };
const MAX_SPEED = 12;
const ACCEL = 0.15;
const BRAKE = 0.3;
const DECEL = 0.05;
const STEER_SPEED = 0.035;
const CENTRIFUGAL = 0.3;

// AI Racers
let racers = [];
function initRacers() {
    racers = [
        { pos: 200, x: -0.3, speed: 7+Math.random()*2, color: '#ef4444', name: 'Red' },
        { pos: 400, x: 0.2, speed: 6.5+Math.random()*2, color: '#3b82f6', name: 'Blue' },
        { pos: 600, x: 0, speed: 6+Math.random()*2, color: '#22c55e', name: 'Green' },
    ];
}

// State
let keys = {}, gameState = 'countdown', countdownTimer = 180, raceTime = 0;
let totalLaps = 3, finished = false;

// Input
document.addEventListener('keydown', e => { keys[e.key]=true; });
document.addEventListener('keyup', e => { keys[e.key]=false; });
// Touch steering
let touchX = null;
canvas.addEventListener('touchstart', e => { e.preventDefault(); touchX=e.touches[0].clientX; keys['gas']=true; });
canvas.addEventListener('touchmove', e => { e.preventDefault();
    const dx = e.touches[0].clientX - touchX;
    keys['ArrowLeft'] = dx < -20;
    keys['ArrowRight'] = dx > 20;
});
canvas.addEventListener('touchend', e => { e.preventDefault(); keys['gas']=false; keys['ArrowLeft']=false; keys['ArrowRight']=false; });

function newGame() {
    player = { pos: 0, x: 0, speed: 0, lap: 1, steer: 0 };
    initRacers();
    gameState = 'countdown'; countdownTimer = 180; raceTime = 0; finished = false;
    document.getElementById('lap').textContent = '1';
    document.getElementById('pos').textContent = '4';
}

function update() {
    if (gameState === 'countdown') {
        countdownTimer--;
        if (countdownTimer <= 0) gameState = 'racing';
        return;
    }
    if (gameState !== 'racing') return;
    raceTime++;

    // Steering
    if (keys['ArrowLeft'] || keys['a']) player.steer = Math.max(-1, player.steer - STEER_SPEED);
    else if (keys['ArrowRight'] || keys['d']) player.steer = Math.min(1, player.steer + STEER_SPEED);
    else player.steer *= 0.9;

    // Acceleration
    if (keys['ArrowUp'] || keys['w'] || keys['gas']) player.speed = Math.min(MAX_SPEED, player.speed + ACCEL);
    else if (keys['ArrowDown'] || keys['s']) player.speed = Math.max(0, player.speed - BRAKE);
    else player.speed = Math.max(0, player.speed - DECEL);

    // Off-road slowdown
    if (Math.abs(player.x) > 0.8) player.speed *= 0.97;

    // Apply steering + centrifugal force from curves
    const seg = segments[Math.floor(player.pos) % TRACK_LENGTH];
    player.x += player.steer * (player.speed / MAX_SPEED) * 0.06;
    player.x -= seg.curve * CENTRIFUGAL * (player.speed / MAX_SPEED);
    player.x = Math.max(-1.2, Math.min(1.2, player.x));

    // Move forward
    player.pos += player.speed * 0.2;

    // Lap detection
    if (player.pos >= TRACK_LENGTH * player.lap) {
        player.lap++;
        document.getElementById('lap').textContent = Math.min(player.lap, totalLaps);
        const ld = document.getElementById('lap-display');
        if (player.lap > totalLaps) {
            gameState = 'finished'; finished = true;
            ld.textContent = '🏁 FINISH!'; ld.style.opacity = '1';
            const secs = Math.floor(raceTime/60);
            showHighScores('kart', Math.max(1, 300 - secs));
        } else {
            ld.textContent = `LAP ${player.lap}`; ld.style.opacity = '1';
            setTimeout(() => ld.style.opacity = '0', 1500);
        }
    }

    // AI Racers
    racers.forEach(r => {
        const rSeg = segments[Math.floor(r.pos) % TRACK_LENGTH];
        r.speed += (Math.random() - 0.48) * 0.1;
        r.speed = Math.max(5, Math.min(10, r.speed));
        r.pos += r.speed * 0.2;
        r.x += rSeg.curve * 0.01 + (Math.random()-0.5)*0.01;
        r.x = Math.max(-0.6, Math.min(0.6, r.x));
    });

    // Position calculation
    const allPositions = [player.pos, ...racers.map(r=>r.pos)].sort((a,b)=>b-a);
    const myPos = allPositions.indexOf(player.pos) + 1;
    document.getElementById('pos').textContent = myPos;
    document.getElementById('time').textContent = `${Math.floor(raceTime/3600)}:${String(Math.floor((raceTime/60)%60)).padStart(2,'0')}`;
    document.getElementById('speed-fill').style.width = `${(player.speed/MAX_SPEED)*100}%`;
}

// ===== RENDER =====
function draw() {
    // Sky
    const skyGrad = ctx.createLinearGradient(0,0,0,H/2);
    skyGrad.addColorStop(0,'#1e3a5f'); skyGrad.addColorStop(1,'#5c94fc');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0,0,W,H/2);

    // Mountains (parallax)
    ctx.fillStyle='#2d5a27';
    for(let i=0;i<5;i++){
        const mx = ((i*180 - player.pos*0.02 - player.x*50) % 900 + 900) % 900 - 100;
        ctx.beginPath();ctx.moveTo(mx,H/2);ctx.lineTo(mx+80,H/2-40-i*8);ctx.lineTo(mx+160,H/2);ctx.fill();
    }

    // Road rendering (pseudo-3D projection)
    let x = 0, dx = 0;
    let cumCurve = 0;
    const startPos = Math.floor(player.pos);

    for (let n = 0; n < H/2; n++) {
        const segIdx = (startPos + n) % TRACK_LENGTH;
        const seg = segments[segIdx];
        cumCurve += seg.curve;
        dx += cumCurve;

        const perspective = 1 / (n + 1);
        const projY = H/2 + n;
        const projW = ROAD_W * perspective;
        const projX = W/2 + dx * perspective * 2 - player.x * projW;

        // Road
        const stripe = seg.color;
        ctx.fillStyle = stripe ? '#666' : '#707070';
        ctx.fillRect(projX - projW/2, projY, projW, 2);

        // Road edge (rumble strips)
        const rumbleW = projW * 0.05;
        ctx.fillStyle = stripe ? '#ef4444' : '#fff';
        ctx.fillRect(projX - projW/2 - rumbleW, projY, rumbleW, 2);
        ctx.fillRect(projX + projW/2, projY, rumbleW, 2);

        // Center line
        if (stripe && n % 4 < 2) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(projX - 1, projY, 2, 2);
        }

        // Lane markers
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(projX - projW/6, projY, 1, 2);
        ctx.fillRect(projX + projW/6, projY, 1, 2);

        // Grass
        ctx.fillStyle = stripe ? '#2d8a4e' : '#3da85e';
        ctx.fillRect(0, projY, projX - projW/2 - rumbleW, 2);
        ctx.fillRect(projX + projW/2 + rumbleW, projY, W, 2);

        // Draw racers at their projected position
        racers.forEach(r => {
            const rDist = r.pos - player.pos;
            if (Math.abs(rDist - n) < 1 && rDist > 0 && rDist < 200) {
                const scale = perspective * 800;
                const rx = projX + r.x * projW * 0.4;
                drawKart(rx, projY, scale, r.color);
            }
        });
    }

    // Player kart
    drawPlayerKart();

    // Countdown
    if (gameState === 'countdown') {
        const num = Math.ceil(countdownTimer / 60);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 64px "Fredoka One"'; ctx.textAlign = 'center';
        ctx.fillText(num > 0 ? num : 'GO!', W/2, H/2);
    }

    // Finish
    if (finished) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
        ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 36px "Fredoka One"'; ctx.textAlign = 'center';
        ctx.fillText('🏁 RACE COMPLETE!', W/2, H/2-10);
        ctx.fillStyle = '#fff'; ctx.font = '18px Nunito';
        ctx.fillText(`Time: ${document.getElementById('time').textContent}`, W/2, H/2+25);
    }
}

function drawKart(x, y, scale, color) {
    const w = Math.max(4, 30*scale), h = Math.max(3, 18*scale);
    ctx.fillStyle = color;
    ctx.fillRect(x-w/2, y-h, w, h);
    // Wheels
    ctx.fillStyle = '#111';
    ctx.fillRect(x-w/2-2, y-3, 4, 4);
    ctx.fillRect(x+w/2-2, y-3, 4, 4);
    // Driver head
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.arc(x, y-h-3*scale, Math.max(2,5*scale), 0, Math.PI*2); ctx.fill();
}

function drawPlayerKart() {
    const kx = W/2 + player.steer*30;
    const ky = H - 50;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(kx, ky+20, 28, 6, 0, 0, Math.PI*2); ctx.fill();
    // Kart body
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(kx-24, ky+12);
    ctx.lineTo(kx-28, ky);
    ctx.lineTo(kx-20, ky-14);
    ctx.lineTo(kx+20, ky-14);
    ctx.lineTo(kx+28, ky);
    ctx.lineTo(kx+24, ky+12);
    ctx.closePath(); ctx.fill();
    // Cockpit
    ctx.fillStyle = '#1e40af';
    ctx.fillRect(kx-12, ky-12, 24, 14);
    // Driver
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.arc(kx, ky-18, 8, 0, Math.PI*2); ctx.fill();
    // Hat (red cap)
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(kx, ky-22, 7, Math.PI, 0); ctx.fill();
    ctx.fillRect(kx-8, ky-20, 16, 4);
    // Wheels
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(kx-30, ky+6, 8, 12);
    ctx.fillRect(kx+22, ky+6, 8, 12);
    // Wheel highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(kx-29, ky+7, 3, 4);
    ctx.fillRect(kx+23, ky+7, 3, 4);
    // Steering tilt effect
    if (Math.abs(player.steer) > 0.3) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        const side = player.steer > 0 ? 1 : -1;
        ctx.fillRect(kx-side*20, ky-10, 4, 20);
    }
}

// ===== LOOP =====
function loop() { update(); draw(); requestAnimationFrame(loop); }
newGame(); loop();
