// ===== PINBALL - Space Cadet Inspired =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const W = 380;
const H = 750;
canvas.width = W;
canvas.height = H;

// Constants
const GRAVITY = 0.28;
const BALL_R = 7;
const FLIPPER_LEN = 52;
const FLIPPER_W = 8;
const LAUNCH_LANE_X = W - 28;

// Colors (Space Cadet inspired)
const C = {
    bg: '#0c0824',
    wall: '#1e1648',
    wallStroke: '#4a3f8a',
    flipper: '#d4d0ff',
    flipperPivot: '#7c6fcf',
    ball: '#e8e4ff',
    ballGlow: '#a78bfa',
    bumperFill: '#2d1b6e',
    bumperStroke: '#a78bfa',
    bumperHit: '#e879f9',
    target: '#facc15',
    targetHit: '#22c55e',
    ramp: '#3730a3',
    lane: 'rgba(167,139,250,0.1)',
    text: '#c4b5fd',
    score: '#fbbf24'
};

// ===== GAME STATE =====
let score = 0, balls = 3, best = parseInt(localStorage.getItem('pinball-best')||'0');
let gameOver = false, ballInPlay = false, launching = false, launchPower = 0;
let multiplier = 1, rank = 0, combo = 0;
let ball = { x: LAUNCH_LANE_X, y: H - 100, vx: 0, vy: 0 };
let particles = [], messages = [];
let leftDown = false, rightDown = false;
let leftAngle = 0.35, rightAngle = Math.PI - 0.35;
const RANKS = ['Cadet','Ensign','Lieutenant','Captain','Commander','Admiral'];

// ===== TABLE ELEMENTS =====
// Walls (polyline segments defining the table shape)
const walls = [
    // Left wall
    {x1:15,y1:H-5},{x1:15,y1:100},{x1:25,y1:50},{x1:60,y1:20},{x1:W-60,y1:20},{x1:W-25,y1:50},
    // Right wall to launch lane
    {x1:W-50,y1:50},{x1:W-50,y1:H-5}
];

// Bumpers (round)
const bumpers = [
    { x:110, y:180, r:22, pts:100, hit:0, color:'#7c3aed' },
    { x:W-130, y:180, r:22, pts:100, hit:0, color:'#7c3aed' },
    { x:W/2, y:150, r:26, pts:150, hit:0, color:'#a855f7' },
    { x:80, y:290, r:18, pts:75, hit:0, color:'#6d28d9' },
    { x:W-100, y:290, r:18, pts:75, hit:0, color:'#6d28d9' },
    { x:W/2-50, y:250, r:16, pts:50, hit:0, color:'#5b21b6' },
    { x:W/2+50, y:250, r:16, pts:50, hit:0, color:'#5b21b6' },
    { x:W/2, y:320, r:20, pts:125, hit:0, color:'#8b5cf6' },
];

// Drop targets (rectangular, can be knocked down)
const dropTargets = [
    { x:55, y:380, w:12, h:20, active:true, pts:200 },
    { x:55, y:405, w:12, h:20, active:true, pts:200 },
    { x:55, y:430, w:12, h:20, active:true, pts:200 },
    { x:W-67, y:380, w:12, h:20, active:true, pts:200 },
    { x:W-67, y:405, w:12, h:20, active:true, pts:200 },
    { x:W-67, y:430, w:12, h:20, active:true, pts:200 },
];

// Rollover lanes (top)
const rollovers = [
    { x:W/2-55, y:75, hit:false, pts:250 },
    { x:W/2-20, y:75, hit:false, pts:250 },
    { x:W/2+15, y:75, hit:false, pts:250 },
    { x:W/2+50, y:75, hit:false, pts:250 },
];

// Kickers (outlane savers)
const kickers = [
    { x:35, y:H-200, r:12, active:true },
    { x:W-55, y:H-200, r:12, active:true },
];

// Slingshots
const slingshots = [
    { x1:40, y1:H-240, x2:40, y2:H-140, x3:85, y3:H-140, side:'left' },
    { x1:W-60, y1:H-240, x2:W-60, y2:H-140, x3:W-105, y3:H-140, side:'right' },
];

// Ramp entries
const ramps = [
    { x:100, y:120, w:40, h:15, pts:500, label:'RAMP' },
    { x:W-160, y:120, w:40, h:15, pts:500, label:'RAMP' },
];

// Flippers
const flippers = {
    left: { x:95, y:H-55, restAngle:0.35, activeAngle:-0.6, len:FLIPPER_LEN },
    right: { x:W-115, y:H-55, restAngle:Math.PI-0.35, activeAngle:Math.PI+0.6, len:FLIPPER_LEN }
};

// Drain guards (posts between flippers)
const drainPosts = [
    { x:70, y:H-30, r:5 },
    { x:W-90, y:H-30, r:5 },
];

// ===== DOM =====
const elScore = document.getElementById('score');
const elBalls = document.getElementById('balls');
const elBest = document.getElementById('best');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
elBest.textContent = best;

// ===== INPUT =====
document.addEventListener('keydown', e => {
    if (e.key==='ArrowLeft'||e.key==='a'||e.key==='A'||e.key==='z'||e.key==='Z') leftDown=true;
    if (e.key==='ArrowRight'||e.key==='d'||e.key==='D'||e.key==='/') rightDown=true;
    if (e.key===' ') { e.preventDefault(); launching=true; }
    if (e.key==='Enter'&&gameOver) resetGame();
});
document.addEventListener('keyup', e => {
    if (e.key==='ArrowLeft'||e.key==='a'||e.key==='A'||e.key==='z'||e.key==='Z') leftDown=false;
    if (e.key==='ArrowRight'||e.key==='d'||e.key==='D'||e.key==='/') rightDown=false;
    if (e.key===' ') { releaseBall(); launching=false; launchPower=0; }
});

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    for (const t of e.touches) {
        const tx = (t.clientX-rect.left)/(rect.width/W);
        if (tx < W*0.35) leftDown=true;
        else if (tx > W*0.65) rightDown=true;
        else { launching=true; }
    }
});
canvas.addEventListener('touchend', e => {
    e.preventDefault();
    leftDown=false; rightDown=false;
    if (launching) { releaseBall(); launching=false; launchPower=0; }
});
document.getElementById('play-again').addEventListener('click', resetGame);

// ===== GAME CONTROL =====
function resetGame() {
    score=0; balls=3; gameOver=false; multiplier=1; rank=0; combo=0;
    overlay.classList.add('hidden');
    elScore.textContent='0'; elBalls.textContent='3';
    dropTargets.forEach(t=>t.active=true);
    rollovers.forEach(r=>r.hit=false);
    kickers.forEach(k=>k.active=true);
    resetBall();
}

function resetBall() {
    ball.x=LAUNCH_LANE_X; ball.y=H-100; ball.vx=0; ball.vy=0;
    ballInPlay=false; launchPower=0;
}

function releaseBall() {
    if (ballInPlay||gameOver) return;
    ballInPlay=true;
    ball.vy = -(10 + launchPower*0.2);
    ball.vx = -0.5;
}

function loseBall() {
    balls--;
    elBalls.textContent=balls;
    combo=0; multiplier=Math.max(1,multiplier-1);
    if (balls<=0) {
        gameOver=true;
        if (score>best) { best=score; localStorage.setItem('pinball-best',String(best)); elBest.textContent=best; }
        overlayTitle.textContent='GAME OVER';
        overlayScore.textContent=`Score: ${score.toLocaleString()} | Rank: ${RANKS[rank]}`;
        overlay.classList.remove('hidden');
    } else { resetBall(); }
}

function addScore(pts, x, y) {
    const total = pts * multiplier;
    score += total;
    combo++;
    if (combo>5 && combo%5===0) { multiplier=Math.min(5,multiplier+1); showMsg('×'+multiplier+' MULTIPLIER!',W/2,H/2); }
    // Rank up
    const rankThresholds = [0,5000,15000,35000,75000,150000];
    const newRank = rankThresholds.filter(t=>score>=t).length-1;
    if (newRank>rank) { rank=newRank; showMsg('RANK UP: '+RANKS[rank],W/2,200); }
    elScore.textContent=score.toLocaleString();
    if (x!==undefined) showMsg('+'+total, x, y);
}

function showMsg(text, x, y) {
    messages.push({ text, x, y, life:1.5 });
}

function spawnParticles(x, y, color, n) {
    for(let i=0;i<n;i++) particles.push({
        x, y, vx:(Math.random()-0.5)*8, vy:(Math.random()-0.5)*8-2,
        life:1, color
    });
}

// ===== PHYSICS =====
function update() {
    if (gameOver) return;
    // Launch charging
    if (launching && !ballInPlay) { launchPower=Math.min(launchPower+2.5,100); return; }
    if (!ballInPlay) return;

    // Gravity & friction
    ball.vy += GRAVITY;
    ball.vx *= 0.998;
    ball.vy *= 0.998;
    // Speed cap
    const spd = Math.sqrt(ball.vx*ball.vx+ball.vy*ball.vy);
    if (spd>18) { ball.vx*=18/spd; ball.vy*=18/spd; }

    ball.x += ball.vx;
    ball.y += ball.vy;

    // Table walls
    const wallL = 15, wallR = W-50, wallT = 20;
    if (ball.x-BALL_R < wallL) { ball.x=wallL+BALL_R; ball.vx=Math.abs(ball.vx)*0.75; }
    if (ball.x+BALL_R > wallR && ball.y < H-150) { ball.x=wallR-BALL_R; ball.vx=-Math.abs(ball.vx)*0.75; }
    // Launch lane right wall
    if (ball.x+BALL_R > W-12) { ball.x=W-12-BALL_R; ball.vx=-Math.abs(ball.vx)*0.5; }
    if (ball.y-BALL_R < wallT) { ball.y=wallT+BALL_R; ball.vy=Math.abs(ball.vy)*0.6; }
    // Curved top corners
    const cornerR = 40;
    checkCorner(wallL+cornerR, wallT+cornerR, cornerR, ball);
    checkCorner(wallR-cornerR, wallT+cornerR, cornerR, ball);

    // Ball drain
    if (ball.y > H+20) { loseBall(); return; }

    // Bumpers
    bumpers.forEach(b => {
        const dx=ball.x-b.x, dy=ball.y-b.y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if (dist < BALL_R+b.r) {
            const nx=dx/dist, ny=dy/dist;
            ball.x=b.x+nx*(BALL_R+b.r+1);
            ball.y=b.y+ny*(BALL_R+b.r+1);
            const speed=Math.max(Math.sqrt(ball.vx*ball.vx+ball.vy*ball.vy),7);
            ball.vx=nx*speed*1.15; ball.vy=ny*speed*1.15;
            b.hit=1;
            addScore(b.pts, b.x, b.y-b.r-10);
            spawnParticles(b.x, b.y, b.color, 6);
        } else { b.hit=Math.max(0,b.hit-0.04); }
    });

    // Drop targets
    dropTargets.forEach(t => {
        if (!t.active) return;
        if (ball.x>t.x-5 && ball.x<t.x+t.w+5 && ball.y>t.y && ball.y<t.y+t.h) {
            t.active=false;
            addScore(t.pts, t.x, t.y);
            spawnParticles(t.x+t.w/2, t.y+t.h/2, '#facc15', 4);
            ball.vx*=-0.5;
            // Check if all in a bank are cleared
            const leftBank=dropTargets.slice(0,3), rightBank=dropTargets.slice(3,6);
            if (leftBank.every(d=>!d.active)) { addScore(2000,80,400); showMsg('LEFT BANK CLEAR!',W/2,H/2-40); leftBank.forEach(d=>d.active=true); }
            if (rightBank.every(d=>!d.active)) { addScore(2000,W-80,400); showMsg('RIGHT BANK CLEAR!',W/2,H/2-40); rightBank.forEach(d=>d.active=true); }
        }
    });

    // Rollovers
    rollovers.forEach(r => {
        if (r.hit) return;
        if (Math.abs(ball.x-r.x)<14 && Math.abs(ball.y-r.y)<10) {
            r.hit=true;
            addScore(r.pts, r.x, r.y-15);
            spawnParticles(r.x, r.y, '#facc15', 3);
        }
    });
    if (rollovers.every(r=>r.hit)) {
        addScore(5000, W/2, 60);
        showMsg('ALL LANES! +5000', W/2, 120);
        rollovers.forEach(r=>r.hit=false);
    }

    // Ramps
    ramps.forEach(r => {
        if (ball.x>r.x && ball.x<r.x+r.w && ball.y>r.y && ball.y<r.y+r.h && ball.vy<-3) {
            addScore(r.pts, r.x+r.w/2, r.y-15);
            spawnParticles(r.x+r.w/2, r.y, '#818cf8', 8);
            ball.vy=-12; ball.vx+=(Math.random()-0.5)*3;
            showMsg('RAMP!', r.x+r.w/2, r.y-30);
        }
    });

    // Kickers
    kickers.forEach(k => {
        if (!k.active) return;
        const dx=ball.x-k.x, dy=ball.y-k.y;
        if (Math.sqrt(dx*dx+dy*dy) < BALL_R+k.r) {
            k.active=false;
            ball.vy=-10; ball.vx=(k.x<W/2?3:-3);
            addScore(300, k.x, k.y-15);
            showMsg('KICKER SAVE!', W/2, H/2);
            spawnParticles(k.x, k.y, '#22c55e', 6);
            setTimeout(()=>k.active=true, 8000);
        }
    });

    // Slingshots
    slingshots.forEach(s => {
        const cx=(s.x1+s.x2+s.x3)/3, cy=(s.y1+s.y2+s.y3)/3;
        const dx=ball.x-cx, dy=ball.y-cy;
        if (Math.sqrt(dx*dx+dy*dy) < 35) {
            if (s.side==='left') { ball.vx=Math.abs(ball.vx)+4; ball.vy-=2; }
            else { ball.vx=-Math.abs(ball.vx)-4; ball.vy-=2; }
            addScore(50, cx, cy-20);
            spawnParticles(cx, cy, '#f472b6', 3);
        }
    });

    // Drain posts
    drainPosts.forEach(p => {
        const dx=ball.x-p.x, dy=ball.y-p.y;
        const dist=Math.sqrt(dx*dx+dy*dy);
        if (dist<BALL_R+p.r) {
            const nx=dx/dist, ny=dy/dist;
            ball.x=p.x+nx*(BALL_R+p.r+1); ball.y=p.y+ny*(BALL_R+p.r+1);
            ball.vx+=nx*2; ball.vy+=ny*2;
        }
    });

    // Flipper collisions
    checkFlipperHit(flippers.left, leftAngle, leftDown);
    checkFlipperHit(flippers.right, rightAngle, rightDown);

    // Update flipper angles
    const lTarget = leftDown ? flippers.left.activeAngle : flippers.left.restAngle;
    leftAngle += (lTarget-leftAngle)*0.35;
    const rTarget = rightDown ? flippers.right.activeAngle : flippers.right.restAngle;
    rightAngle += (rTarget-rightAngle)*0.35;

    // Particles & messages
    particles = particles.filter(p=>p.life>0);
    particles.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.15; p.life-=0.035; });
    messages = messages.filter(m=>m.life>0);
    messages.forEach(m=>{ m.y-=0.5; m.life-=0.02; });
}

function checkCorner(cx, cy, r, b) {
    const dx=b.x-cx, dy=b.y-cy;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if (dist>r && (b.x<cx || b.y<cy)) {
        const nx=dx/dist, ny=dy/dist;
        b.x=cx+nx*r; b.y=cy+ny*r;
        // Reflect velocity
        const dot=b.vx*nx+b.vy*ny;
        if (dot<0) { b.vx-=2*dot*nx*0.7; b.vy-=2*dot*ny*0.7; }
    }
}

function checkFlipperHit(f, angle, isDown) {
    const cos=Math.cos(angle), sin=Math.sin(angle);
    const ex=f.x+cos*f.len, ey=f.y+sin*f.len;
    const dx=ex-f.x, dy=ey-f.y, len2=dx*dx+dy*dy;
    let t=((ball.x-f.x)*dx+(ball.y-f.y)*dy)/len2;
    t=Math.max(0,Math.min(1,t));
    const nx_=ball.x-(f.x+t*dx), ny_=ball.y-(f.y+t*dy);
    const dist=Math.sqrt(nx_*nx_+ny_*ny_);
    if (dist < BALL_R+FLIPPER_W/2) {
        const nx=nx_/(dist||1), ny=ny_/(dist||1);
        ball.x=(f.x+t*dx)+nx*(BALL_R+FLIPPER_W/2+1);
        ball.y=(f.y+t*dy)+ny*(BALL_R+FLIPPER_W/2+1);
        const power = isDown ? 14 : 3;
        ball.vx += nx*power*0.4;
        ball.vy = -Math.abs(power*(0.8+t*0.4));
    }
}

// ===== RENDERING =====
function draw() {
    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0,0,W,H);

    // Table surface gradient
    const tGrad = ctx.createLinearGradient(0,0,0,H);
    tGrad.addColorStop(0,'#100a2e');
    tGrad.addColorStop(0.5,'#0c0824');
    tGrad.addColorStop(1,'#080418');
    ctx.fillStyle = tGrad;
    ctx.fillRect(15,20,W-65,H-20);

    // Wall outlines
    ctx.strokeStyle = C.wallStroke;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(15,H); ctx.lineTo(15,100); ctx.quadraticCurveTo(15,20,60,20);
    ctx.lineTo(W-80,20); ctx.quadraticCurveTo(W-50,20,W-50,60);
    ctx.lineTo(W-50,H);
    ctx.stroke();
    // Launch lane separator
    ctx.beginPath(); ctx.moveTo(W-50,60); ctx.lineTo(W-50,H-150); ctx.stroke();
    ctx.strokeStyle='rgba(74,63,138,0.4)';
    ctx.beginPath(); ctx.moveTo(W-12,20); ctx.lineTo(W-12,H); ctx.stroke();

    // Rollover lanes
    rollovers.forEach(r => {
        ctx.fillStyle = r.hit ? C.targetHit : 'rgba(250,204,21,0.2)';
        ctx.beginPath(); ctx.arc(r.x, r.y, 10, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = r.hit ? C.targetHit : C.target;
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(r.x, r.y, 10, 0, Math.PI*2); ctx.stroke();
        if (r.hit) { ctx.fillStyle='#fff'; ctx.font='bold 9px Nunito'; ctx.textAlign='center'; ctx.fillText('✓',r.x,r.y+3); }
    });

    // Ramps
    ramps.forEach(r => {
        ctx.fillStyle='rgba(55,48,163,0.4)';
        ctx.fillRect(r.x,r.y,r.w,r.h);
        ctx.strokeStyle='#6366f1'; ctx.lineWidth=2;
        ctx.strokeRect(r.x,r.y,r.w,r.h);
        ctx.fillStyle='#a5b4fc'; ctx.font='bold 8px Nunito'; ctx.textAlign='center';
        ctx.fillText(r.label, r.x+r.w/2, r.y+11);
    });

    // Bumpers
    bumpers.forEach(b => {
        const glow = b.hit;
        const grad = ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r+glow*8);
        grad.addColorStop(0, glow>0.3 ? C.bumperHit : b.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle=grad;
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r+glow*8,0,Math.PI*2); ctx.fill();
        // Inner
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = glow>0.3 ? '#fff' : C.bumperStroke;
        ctx.lineWidth = 2+glow*2;
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.stroke();
        // Score text
        ctx.fillStyle=`rgba(255,255,255,${0.6+glow*0.4})`;
        ctx.font='bold 10px Nunito'; ctx.textAlign='center';
        ctx.fillText(b.pts, b.x, b.y+4);
    });

    // Drop targets
    dropTargets.forEach(t => {
        if (!t.active) return;
        ctx.fillStyle='#facc15';
        ctx.fillRect(t.x, t.y, t.w, t.h);
        ctx.strokeStyle='#ca8a04'; ctx.lineWidth=1;
        ctx.strokeRect(t.x, t.y, t.w, t.h);
    });

    // Slingshots
    slingshots.forEach(s => {
        ctx.fillStyle='rgba(244,114,182,0.1)';
        ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.lineTo(s.x3,s.y3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(244,114,182,0.5)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.lineTo(s.x3,s.y3); ctx.closePath(); ctx.stroke();
    });

    // Kickers
    kickers.forEach(k => {
        ctx.fillStyle = k.active ? 'rgba(34,197,94,0.3)' : 'rgba(100,100,100,0.1)';
        ctx.beginPath(); ctx.arc(k.x,k.y,k.r,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = k.active ? '#22c55e' : '#555';
        ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(k.x,k.y,k.r,0,Math.PI*2); ctx.stroke();
        if (k.active) { ctx.fillStyle='#fff'; ctx.font='bold 8px Nunito'; ctx.textAlign='center'; ctx.fillText('K',k.x,k.y+3); }
    });

    // Drain posts
    drainPosts.forEach(p => {
        ctx.fillStyle='#4a3f8a';
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    });

    // Flippers
    drawFlipper(flippers.left, leftAngle);
    drawFlipper(flippers.right, rightAngle);

    // Ball
    if (ballInPlay || !gameOver) {
        // Glow
        ctx.shadowColor=C.ballGlow; ctx.shadowBlur=12;
        const bGrad=ctx.createRadialGradient(ball.x-2,ball.y-2,0,ball.x,ball.y,BALL_R);
        bGrad.addColorStop(0,'#fff');
        bGrad.addColorStop(1,C.ball);
        ctx.fillStyle=bGrad;
        ctx.beginPath(); ctx.arc(ball.x,ball.y,BALL_R,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
    }

    // Launch power bar
    if (launching && !ballInPlay) {
        const barH=launchPower*0.8;
        const grad=ctx.createLinearGradient(0,H-50-barH,0,H-50);
        grad.addColorStop(0,'#a78bfa'); grad.addColorStop(1,'#7c3aed');
        ctx.fillStyle=grad;
        ctx.fillRect(W-38, H-50-barH, 14, barH);
        ctx.strokeStyle='#c4b5fd'; ctx.lineWidth=1;
        ctx.strokeRect(W-38, H-50-barH, 14, barH);
    }

    // Particles
    particles.forEach(p => {
        const r=Math.max(0,3*p.life);
        if(r<=0)return;
        ctx.fillStyle=p.color;
        ctx.globalAlpha=p.life;
        ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=1;
    });

    // Messages
    messages.forEach(m => {
        ctx.fillStyle=`rgba(255,255,255,${Math.min(1,m.life*2)})`;
        ctx.font='bold 13px Fredoka One';
        ctx.textAlign='center';
        ctx.fillText(m.text, m.x, m.y);
    });

    // HUD overlay on canvas
    ctx.fillStyle='rgba(196,181,253,0.6)';
    ctx.font='bold 10px Nunito';
    ctx.textAlign='left';
    ctx.fillText('×'+multiplier, 20, H-10);
    ctx.textAlign='right';
    ctx.fillText(RANKS[rank], W-55, H-10);
}

function drawFlipper(f, angle) {
    const cos=Math.cos(angle), sin=Math.sin(angle);
    const ex=f.x+cos*f.len, ey=f.y+sin*f.len;
    // Shadow
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=FLIPPER_W+4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(f.x+1,f.y+2); ctx.lineTo(ex+1,ey+2); ctx.stroke();
    // Flipper body
    ctx.strokeStyle=C.flipper; ctx.lineWidth=FLIPPER_W; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(f.x,f.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Highlight
    ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=3; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(f.x,f.y-2); ctx.lineTo(ex,ey-2); ctx.stroke();
    // Pivot
    ctx.fillStyle=C.flipperPivot;
    ctx.beginPath(); ctx.arc(f.x,f.y,5,0,Math.PI*2); ctx.fill();
}

// ===== GAME LOOP =====
let lastTime = performance.now();
function loop(now) {
    const dt = Math.min(now-lastTime, 32); // cap at ~30fps min
    lastTime = now;
    // Run physics at ~60fps steps
    const steps = Math.ceil(dt/16.67);
    for (let i=0;i<steps;i++) update();
    draw();
    requestAnimationFrame(loop);
}
resetGame();
requestAnimationFrame(loop);
