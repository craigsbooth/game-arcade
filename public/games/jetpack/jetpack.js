// ===== JETPACK JOYRIDE =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 700, H = 400;
canvas.width = W; canvas.height = H;

// Constants
const GRAVITY = 0.5;
const THRUST = -0.7;
const GROUND_Y = H - 40;
const CEIL_Y = 30;
const PLAYER_X = 80;

// State
let player, obstacles, coins, particles, distance, coinCount;
let speed, gameState, best, frameCount;
let holding = false;
best = parseInt(localStorage.getItem('jetpack-best') || '0');

// DOM
const overlay = document.getElementById('overlay');
const startOverlay = document.getElementById('start-overlay');
document.getElementById('retry-btn').addEventListener('click', newGame);

// Input
document.addEventListener('keydown', e => { if(e.key===' '||e.key==='ArrowUp'){e.preventDefault(); startFlying();} });
document.addEventListener('keyup', e => { if(e.key===' '||e.key==='ArrowUp') holding=false; });
canvas.addEventListener('mousedown', e => { e.preventDefault(); startFlying(); });
canvas.addEventListener('mouseup', () => holding=false);
canvas.addEventListener('touchstart', e => { e.preventDefault(); startFlying(); });
canvas.addEventListener('touchend', e => { e.preventDefault(); holding=false; });
startOverlay.addEventListener('click', e => { e.preventDefault(); startFlying(); });

function startFlying() {
    if (gameState==='dead') return;
    if (gameState==='ready') { gameState='playing'; startOverlay.classList.add('hidden'); }
    holding=true;
}

// ===== GAME =====
function newGame() {
    player = { y: GROUND_Y-20, vy: 0, running: true };
    obstacles = [];
    coins = [];
    particles = [];
    distance = 0;
    coinCount = 0;
    speed = 4;
    frameCount = 0;
    gameState = 'ready';
    overlay.classList.add('hidden');
    startOverlay.classList.remove('hidden');
    updateHUD();
}

function updateHUD() {
    document.querySelector('#hud-dist span').textContent = Math.floor(distance);
    document.querySelector('#hud-coins span').textContent = coinCount;
}

function spawnObstacle() {
    const types = ['zapper_h','zapper_v','missile'];
    const type = types[Math.floor(Math.random()*types.length)];
    if (type==='zapper_h') {
        const y = 60+Math.random()*(GROUND_Y-140);
        obstacles.push({ type, x:W+20, y, w:90, h:16 });
    } else if (type==='zapper_v') {
        const y = 50+Math.random()*(GROUND_Y-150);
        obstacles.push({ type, x:W+20, y, w:16, h:100 });
    } else {
        const y = 40+Math.random()*(GROUND_Y-80);
        obstacles.push({ type, x:W+60, y, w:40, h:14, warning:30 });
    }
}

function spawnCoins() {
    const pattern = Math.floor(Math.random()*3);
    const baseY = 60+Math.random()*(GROUND_Y-160);
    for (let i=0; i<5; i++) {
        let cx=W+40+i*30, cy=baseY;
        if (pattern===1) cy=baseY+Math.sin(i*0.8)*30; // wave
        if (pattern===2) cy=baseY-i*15; // diagonal
        coins.push({ x:cx, y:cy, collected:false });
    }
}

function update() {
    if (gameState!=='playing') return;
    frameCount++;
    distance += speed * 0.05;
    speed = 4 + distance * 0.003; // gradually faster

    // Player physics
    if (holding) {
        player.vy += THRUST;
        player.running = false;
        // Thrust particles
        if (frameCount%2===0) {
            particles.push({
                x:PLAYER_X-5+Math.random()*10, y:player.y+18,
                vx:-1-Math.random()*2, vy:2+Math.random()*2,
                life:0.6, color:'#f97316', size:4+Math.random()*3
            });
        }
    } else {
        player.vy += GRAVITY;
    }
    player.y += player.vy;
    player.vy *= 0.95; // air resistance

    // Bounds
    if (player.y > GROUND_Y-20) { player.y=GROUND_Y-20; player.vy=0; player.running=true; }
    if (player.y < CEIL_Y) { player.y=CEIL_Y; player.vy=0; }

    // Spawn
    if (frameCount%80===0) spawnObstacle();
    if (frameCount%60===0) spawnCoins();

    // Move obstacles
    obstacles.forEach(o => {
        if (o.type==='missile') {
            if (o.warning>0) { o.warning--; }
            else { o.x -= speed*2.2; }
        } else {
            o.x -= speed;
        }
    });
    obstacles = obstacles.filter(o => o.x+o.w > -50);

    // Move coins
    coins.forEach(c => { c.x -= speed; });
    coins = coins.filter(c => c.x > -20 || c.collected);

    // Collision: player hitbox approx 20x30 centered at PLAYER_X, player.y
    const px=PLAYER_X-10, py=player.y-15, pw=20, ph=30;
    obstacles.forEach(o => {
        if (o.warning && o.warning>0) return;
        if (px+pw>o.x && px<o.x+o.w && py+ph>o.y && py<o.y+o.h) {
            die();
        }
    });

    // Coin collection
    coins.forEach(c => {
        if (c.collected) return;
        if (Math.abs(PLAYER_X-c.x)<18 && Math.abs(player.y-c.y)<18) {
            c.collected=true;
            coinCount++;
            particles.push({x:c.x,y:c.y,vx:0,vy:-2,life:0.8,color:'#facc15',size:8});
        }
    });

    // Particles
    particles=particles.filter(p=>p.life>0);
    particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life-=0.04;p.size*=0.96;});

    updateHUD();
}

function die() {
    gameState='dead';
    if (Math.floor(distance)>best) { best=Math.floor(distance); localStorage.setItem('jetpack-best',String(best)); }
    document.getElementById('ov-stats').textContent=`Distance: ${Math.floor(distance)}m | Coins: ${coinCount}`;
    document.getElementById('ov-best').textContent=`Best: ${best}m`;
    overlay.classList.remove('hidden');
    // Death particles
    for(let i=0;i<15;i++) particles.push({x:PLAYER_X,y:player.y,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6,life:1,color:'#ef4444',size:4});
}

// ===== RENDER =====
function draw() {
    // Background - lab corridor
    const bgGrad = ctx.createLinearGradient(0,0,0,H);
    bgGrad.addColorStop(0,'#2d2d44');
    bgGrad.addColorStop(1,'#1a1a2e');
    ctx.fillStyle=bgGrad;
    ctx.fillRect(0,0,W,H);

    // Background panels (parallax)
    ctx.fillStyle='rgba(255,255,255,0.02)';
    for(let i=0;i<8;i++){
        const px=((i*120-frameCount*0.5)%W+W)%W;
        ctx.fillRect(px,10,80,GROUND_Y-20);
    }
    // Background lights
    ctx.fillStyle='rgba(255,200,50,0.03)';
    for(let i=0;i<5;i++){
        const lx=((i*160-frameCount*0.8)%W+W)%W;
        ctx.fillRect(lx,0,40,8);
    }

    // Ceiling
    ctx.fillStyle='#3d3d5c';
    ctx.fillRect(0,0,W,CEIL_Y-5);
    ctx.fillStyle='#555580';
    ctx.fillRect(0,CEIL_Y-5,W,5);

    // Floor
    ctx.fillStyle='#3d3d5c';
    ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);
    ctx.fillStyle='#555580';
    ctx.fillRect(0,GROUND_Y,W,3);
    // Floor tiles
    ctx.strokeStyle='rgba(255,255,255,0.05)';
    ctx.lineWidth=1;
    for(let i=0;i<20;i++){
        const tx=((i*50-frameCount*speed*0.5)%W+W)%W;
        ctx.beginPath();ctx.moveTo(tx,GROUND_Y);ctx.lineTo(tx,H);ctx.stroke();
    }

    // Coins
    coins.forEach(c=>{
        if(c.collected) return;
        ctx.fillStyle='#facc15';
        ctx.shadowColor='#facc15'; ctx.shadowBlur=6;
        ctx.beginPath(); ctx.arc(c.x,c.y,8,0,Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        ctx.fillStyle='#ca8a04';
        ctx.beginPath(); ctx.arc(c.x,c.y,4,0,Math.PI*2); ctx.fill();
    });

    // Obstacles
    obstacles.forEach(o=>{
        if(o.type==='zapper_h'||o.type==='zapper_v'){
            // Zapper: electric beam with end nodes
            ctx.fillStyle='#ef4444';
            ctx.shadowColor='#ef4444'; ctx.shadowBlur=8;
            ctx.fillRect(o.x,o.y,o.w,o.h);
            ctx.shadowBlur=0;
            // Nodes
            ctx.fillStyle='#fca5a5';
            if(o.type==='zapper_h'){
                ctx.beginPath();ctx.arc(o.x,o.y+o.h/2,8,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(o.x+o.w,o.y+o.h/2,8,0,Math.PI*2);ctx.fill();
            } else {
                ctx.beginPath();ctx.arc(o.x+o.w/2,o.y,8,0,Math.PI*2);ctx.fill();
                ctx.beginPath();ctx.arc(o.x+o.w/2,o.y+o.h,8,0,Math.PI*2);ctx.fill();
            }
            // Electric flicker
            ctx.strokeStyle=`rgba(255,200,200,${0.3+Math.random()*0.4})`;
            ctx.lineWidth=2;
            ctx.beginPath();
            if(o.type==='zapper_h'){
                for(let i=0;i<o.w;i+=8){ctx.lineTo(o.x+i,o.y+o.h/2+(Math.random()-0.5)*o.h);}
            } else {
                for(let i=0;i<o.h;i+=8){ctx.lineTo(o.x+o.w/2+(Math.random()-0.5)*o.w,o.y+i);}
            }
            ctx.stroke();
        } else if(o.type==='missile'){
            if(o.warning>0){
                // Warning indicator
                ctx.fillStyle=`rgba(239,68,68,${0.5+Math.sin(frameCount*0.5)*0.5})`;
                ctx.font='bold 20px Nunito';
                ctx.textAlign='right';
                ctx.fillText('⚠',W-10,o.y+10);
            } else {
                // Missile body
                ctx.fillStyle='#6b7280';
                ctx.fillRect(o.x,o.y,o.w,o.h);
                ctx.fillStyle='#ef4444';
                ctx.fillRect(o.x,o.y+2,8,o.h-4);
                // Exhaust
                ctx.fillStyle='rgba(249,115,22,0.6)';
                ctx.beginPath();ctx.moveTo(o.x+o.w,o.y);ctx.lineTo(o.x+o.w+12+Math.random()*8,o.y+o.h/2);ctx.lineTo(o.x+o.w,o.y+o.h);ctx.fill();
            }
        }
    });

    // Player
    drawPlayer();

    // Particles
    particles.forEach(p=>{
        if(p.size<=0) return;
        ctx.globalAlpha=p.life;
        ctx.fillStyle=p.color;
        ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
    });
    ctx.globalAlpha=1;
}

function drawPlayer() {
    const px=PLAYER_X, py=player.y;
    ctx.save();

    // Body
    ctx.fillStyle='#4ade80';
    ctx.fillRect(px-8, py-12, 16, 24);
    // Head
    ctx.fillStyle='#fde68a';
    ctx.beginPath(); ctx.arc(px, py-16, 8, 0, Math.PI*2); ctx.fill();
    // Helmet visor
    ctx.fillStyle='#60a5fa';
    ctx.beginPath(); ctx.arc(px+2, py-16, 5, -0.5, 1.2); ctx.fill();
    // Jetpack
    ctx.fillStyle='#6b7280';
    ctx.fillRect(px-14, py-8, 6, 18);
    ctx.fillStyle='#9ca3af';
    ctx.fillRect(px-13, py-6, 4, 4);

    // Legs - running animation
    if (player.running && gameState==='playing') {
        const legPhase = frameCount*0.3;
        ctx.fillStyle='#1e40af';
        ctx.fillRect(px-5, py+12, 5, 8+Math.sin(legPhase)*3);
        ctx.fillRect(px+1, py+12, 5, 8+Math.cos(legPhase)*3);
    } else {
        ctx.fillStyle='#1e40af';
        ctx.fillRect(px-5, py+12, 5, 8);
        ctx.fillRect(px+1, py+12, 5, 8);
    }

    // Thrust fire
    if (holding && gameState==='playing') {
        ctx.fillStyle=`rgba(249,115,22,${0.7+Math.random()*0.3})`;
        ctx.beginPath();
        ctx.moveTo(px-14, py+12);
        ctx.lineTo(px-11, py+20+Math.random()*10);
        ctx.lineTo(px-8, py+12);
        ctx.fill();
        ctx.fillStyle=`rgba(253,224,71,${0.5+Math.random()*0.3})`;
        ctx.beginPath();
        ctx.moveTo(px-13, py+12);
        ctx.lineTo(px-11, py+16+Math.random()*6);
        ctx.lineTo(px-9, py+12);
        ctx.fill();
    }

    ctx.restore();
}

// ===== LOOP =====
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

newGame();
loop();
