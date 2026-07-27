// ===== JETPACK JOYRIDE - Enhanced Graphics =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 700, H = 400;
canvas.width = W; canvas.height = H;

// Constants
const GRAVITY = 0.5;
const THRUST = -0.7;
const GROUND_Y = H - 50;
const CEIL_Y = 40;
const PLAYER_X = 90;

// State
let player, obstacles, coins, particles, distance, coinCount;
let speed, gameState, best, frameCount;
let holding = false;
best = parseInt(localStorage.getItem('jetpack-best') || '0');

// Background elements
let bgPanels = [], bgPipes = [], bgLights = [];
for (let i=0;i<10;i++) bgPanels.push({x:i*100, w:80+Math.random()*40, shade:Math.random()*0.03});
for (let i=0;i<6;i++) bgPipes.push({x:i*140+Math.random()*40, y:CEIL_Y+Math.random()*20});
for (let i=0;i<8;i++) bgLights.push({x:i*100+20, flicker:Math.random()*Math.PI*2});

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
startOverlay.addEventListener('touchstart', e => { e.preventDefault(); startFlying(); });

function startFlying() {
    if (gameState==='dead') return;
    if (gameState==='ready') { gameState='playing'; startOverlay.classList.add('hidden'); }
    holding=true;
}

// ===== GAME =====
function newGame() {
    player = { y: GROUND_Y-24, vy: 0, running: true, legPhase: 0 };
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
    const types = ['zapper_h','zapper_v','zapper_diag','missile'];
    const type = types[Math.floor(Math.random()*types.length)];
    if (type==='zapper_h') {
        const y = 70+Math.random()*(GROUND_Y-150);
        obstacles.push({ type, x:W+20, y, w:100, h:12, angle:0 });
    } else if (type==='zapper_v') {
        const y = 50+Math.random()*(GROUND_Y-160);
        obstacles.push({ type, x:W+20, y, w:12, h:110, angle:0 });
    } else if (type==='zapper_diag') {
        const y = 60+Math.random()*(GROUND_Y-180);
        obstacles.push({ type, x:W+20, y, w:100, h:12, angle:Math.random()>0.5?0.4:-0.4 });
    } else {
        const y = 50+Math.random()*(GROUND_Y-100);
        obstacles.push({ type, x:W+80, y, w:44, h:16, warning:40 });
    }
}

function spawnCoins() {
    const pattern = Math.floor(Math.random()*4);
    const baseY = 70+Math.random()*(GROUND_Y-180);
    for (let i=0; i<6; i++) {
        let cx=W+50+i*28, cy=baseY;
        if (pattern===1) cy=baseY+Math.sin(i*0.9)*35;
        if (pattern===2) cy=baseY-i*18;
        if (pattern===3) cy=baseY+i*12;
        coins.push({ x:cx, y:cy, collected:false, bob:Math.random()*Math.PI*2 });
    }
}

function update() {
    if (gameState!=='playing') {
        if (gameState==='ready') { player.legPhase+=0.08; player.y=GROUND_Y-24; }
        return;
    }
    frameCount++;
    distance += speed * 0.05;
    speed = 4 + distance * 0.002;

    // Player physics
    if (holding) {
        player.vy += THRUST;
        player.running = false;
        // Thrust particles - more detailed
        if (frameCount%2===0) {
            const spread = 6;
            particles.push(
                {x:PLAYER_X-10+Math.random()*4, y:player.y+20, vx:-0.5-Math.random()*1.5, vy:3+Math.random()*3, life:0.7, color:'#f97316', size:5+Math.random()*4, type:'fire'},
                {x:PLAYER_X-10+Math.random()*4, y:player.y+22, vx:-0.3-Math.random(), vy:2+Math.random()*2, life:0.5, color:'#fde047', size:3+Math.random()*3, type:'fire'}
            );
        }
        if (frameCount%4===0) {
            particles.push({x:PLAYER_X-10, y:player.y+24, vx:-1-Math.random()*2, vy:1+Math.random()*2, life:0.9, color:'rgba(150,150,150,0.4)', size:6+Math.random()*5, type:'smoke'});
        }
    } else {
        player.vy += GRAVITY;
    }
    player.y += player.vy;
    player.vy *= 0.94;

    if (player.y > GROUND_Y-24) { player.y=GROUND_Y-24; player.vy=0; player.running=true; }
    if (player.y < CEIL_Y+10) { player.y=CEIL_Y+10; player.vy=1; }

    if (player.running) player.legPhase += 0.25;

    // Spawning
    if (frameCount%75===0) spawnObstacle();
    if (frameCount%55===0) spawnCoins();

    // Move obstacles
    obstacles.forEach(o => {
        if (o.type==='missile') {
            if (o.warning>0) o.warning--;
            else o.x -= speed*2.5;
        } else {
            o.x -= speed;
        }
    });
    obstacles = obstacles.filter(o => o.x+o.w > -60);

    // Move coins
    coins.forEach(c => { c.x -= speed; c.bob += 0.06; });
    coins = coins.filter(c => c.x > -20);

    // Collision
    const px=PLAYER_X-12, py=player.y-16, pw=24, ph=34;
    obstacles.forEach(o => {
        if (o.warning && o.warning>0) return;
        // Rotated hitbox for diagonal zappers
        let ox=o.x, oy=o.y, ow=o.w, oh=o.h;
        if (px+pw>ox && px<ox+ow && py+ph>oy && py<oy+oh) die();
    });

    // Coins
    coins.forEach(c => {
        if (c.collected) return;
        const coinY = c.y + Math.sin(c.bob)*3;
        if (Math.abs(PLAYER_X-c.x)<20 && Math.abs(player.y-coinY)<20) {
            c.collected=true;
            coinCount++;
            for(let i=0;i<4;i++) particles.push({x:c.x,y:coinY,vx:(Math.random()-0.5)*3,vy:-2-Math.random()*2,life:0.7,color:'#facc15',size:4,type:'spark'});
        }
    });

    // Particles
    particles=particles.filter(p=>p.life>0);
    particles.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy;
        if(p.type==='smoke') { p.size*=1.02; p.vy*=0.95; }
        else { p.vy+=0.05; }
        p.life-=0.035;
        p.size=Math.max(0,p.size*0.97);
    });

    // Scroll background
    bgPanels.forEach(p => { p.x -= speed*0.3; if(p.x+p.w<0) p.x=W+Math.random()*50; });
    bgPipes.forEach(p => { p.x -= speed*0.5; if(p.x<-20) p.x=W+Math.random()*80; });
    bgLights.forEach(l => { l.x -= speed*0.7; if(l.x<-30) l.x=W+Math.random()*30; l.flicker+=0.1; });

    updateHUD();
}

function die() {
    gameState='dead';
    if(Math.floor(distance)>best){best=Math.floor(distance);localStorage.setItem('jetpack-best',String(best));}
    document.getElementById('ov-stats').textContent=`Distance: ${Math.floor(distance)}m | Coins: ${coinCount}`;
    document.getElementById('ov-best').textContent=`Best: ${best}m`;
    overlay.classList.remove('hidden');
    for(let i=0;i<20;i++) particles.push({x:PLAYER_X+Math.random()*20-10,y:player.y+Math.random()*20-10,vx:(Math.random()-0.5)*8,vy:(Math.random()-0.5)*8,life:1,color:Math.random()>0.5?'#ef4444':'#f97316',size:3+Math.random()*5,type:'spark'});
}

// ===== RENDER =====
function draw() {
    // Sky/lab gradient
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#1e1b3a');
    bg.addColorStop(0.5,'#252244');
    bg.addColorStop(1,'#1a1832');
    ctx.fillStyle=bg;
    ctx.fillRect(0,0,W,H);

    // Back wall panels
    bgPanels.forEach(p => {
        ctx.fillStyle=`rgba(255,255,255,${0.015+p.shade})`;
        ctx.fillRect(p.x, CEIL_Y+8, p.w, GROUND_Y-CEIL_Y-16);
        // Panel border
        ctx.strokeStyle='rgba(255,255,255,0.03)';
        ctx.lineWidth=1;
        ctx.strokeRect(p.x, CEIL_Y+8, p.w, GROUND_Y-CEIL_Y-16);
    });

    // Pipes on ceiling
    bgPipes.forEach(p => {
        ctx.fillStyle='#3a3660';
        ctx.fillRect(p.x, p.y, 8, GROUND_Y-p.y-30);
        ctx.fillStyle='#4a4578';
        ctx.fillRect(p.x-2, p.y, 12, 6);
        ctx.fillRect(p.x-2, GROUND_Y-35, 12, 6);
    });

    // Ceiling with metallic look
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, CEIL_Y);
    ceilGrad.addColorStop(0, '#2a2650');
    ceilGrad.addColorStop(1, '#3d3870');
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, W, CEIL_Y);
    // Ceiling rivets
    ctx.fillStyle='rgba(255,255,255,0.08)';
    for(let i=0;i<W;i+=30) ctx.fillRect(i+12,CEIL_Y-4,6,4);
    // Ceiling edge
    ctx.fillStyle='#5a5590';
    ctx.fillRect(0, CEIL_Y-2, W, 4);

    // Floor with metallic plating
    const floorGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    floorGrad.addColorStop(0, '#3d3870');
    floorGrad.addColorStop(1, '#2a2650');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, GROUND_Y, W, H-GROUND_Y);
    // Floor edge highlight
    ctx.fillStyle='#6a65a0';
    ctx.fillRect(0, GROUND_Y, W, 3);
    // Floor tiles with perspective lines
    ctx.strokeStyle='rgba(255,255,255,0.04)';
    ctx.lineWidth=1;
    for(let i=0;i<25;i++){
        const tx = ((i*40 - frameCount*speed*0.4) % (W+40) + W+40) % (W+40) - 20;
        ctx.beginPath(); ctx.moveTo(tx, GROUND_Y); ctx.lineTo(tx, H); ctx.stroke();
    }
    // Hazard stripe at floor edge
    ctx.fillStyle = 'rgba(234,179,8,0.15)';
    for(let i=0;i<W;i+=40) {
        const sx = ((i - frameCount*speed*0.4) % (W+40) + W+40) % (W+40) - 20;
        ctx.beginPath(); ctx.moveTo(sx,GROUND_Y+3); ctx.lineTo(sx+12,GROUND_Y+3); ctx.lineTo(sx+20,GROUND_Y+12); ctx.lineTo(sx+8,GROUND_Y+12); ctx.fill();
    }

    // Overhead lights
    bgLights.forEach(l => {
        const brightness = 0.4 + Math.sin(l.flicker)*0.1;
        // Light fixture
        ctx.fillStyle='#4a4578';
        ctx.fillRect(l.x-4, CEIL_Y, 8, 10);
        // Light glow cone
        const glow = ctx.createRadialGradient(l.x, CEIL_Y+10, 0, l.x, CEIL_Y+60, 80);
        glow.addColorStop(0, `rgba(255,240,180,${brightness*0.08})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(l.x-80, CEIL_Y, 160, 120);
        // Bulb
        ctx.fillStyle=`rgba(255,240,180,${brightness})`;
        ctx.beginPath(); ctx.arc(l.x, CEIL_Y+8, 3, 0, Math.PI*2); ctx.fill();
    });

    // Coins
    coins.forEach(c => {
        if(c.collected) return;
        const cy = c.y + Math.sin(c.bob)*3;
        // Glow
        ctx.shadowColor='#facc15'; ctx.shadowBlur=8;
        // Coin body (3D-ish circle)
        ctx.fillStyle='#facc15';
        ctx.beginPath(); ctx.ellipse(c.x, cy, 9, 9, 0, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur=0;
        // Inner ring
        ctx.strokeStyle='#ca8a04'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(c.x, cy, 5, 0, Math.PI*2); ctx.stroke();
        // Shine
        ctx.fillStyle='rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(c.x-2, cy-2, 2.5, 0, Math.PI*2); ctx.fill();
    });

    drawObstacles();
    drawPlayer();
    drawParticles();
}

function drawObstacles() {
    obstacles.forEach(o => {
        if(o.type==='missile') {
            if(o.warning>0) {
                const flash = Math.sin(frameCount*0.6)*0.5+0.5;
                ctx.fillStyle=`rgba(239,68,68,${flash})`;
                ctx.font='bold 24px Nunito'; ctx.textAlign='right';
                ctx.fillText('⚠', W-8, o.y+8);
                // Warning line
                ctx.strokeStyle=`rgba(239,68,68,${flash*0.3})`;
                ctx.setLineDash([4,4]); ctx.lineWidth=1;
                ctx.beginPath(); ctx.moveTo(0,o.y+o.h/2); ctx.lineTo(W,o.y+o.h/2); ctx.stroke();
                ctx.setLineDash([]);
            } else {
                // Missile body
                ctx.fillStyle='#6b7280';
                ctx.beginPath();
                ctx.moveTo(o.x, o.y+o.h/2);
                ctx.lineTo(o.x+10, o.y);
                ctx.lineTo(o.x+o.w-8, o.y);
                ctx.lineTo(o.x+o.w, o.y+o.h/2);
                ctx.lineTo(o.x+o.w-8, o.y+o.h);
                ctx.lineTo(o.x+10, o.y+o.h);
                ctx.closePath(); ctx.fill();
                // Red nose
                ctx.fillStyle='#ef4444';
                ctx.beginPath(); ctx.arc(o.x+4, o.y+o.h/2, 5, 0, Math.PI*2); ctx.fill();
                // Window
                ctx.fillStyle='#93c5fd';
                ctx.beginPath(); ctx.arc(o.x+20, o.y+o.h/2, 4, 0, Math.PI*2); ctx.fill();
                // Fins
                ctx.fillStyle='#4b5563';
                ctx.fillRect(o.x+o.w-10, o.y-4, 8, 4);
                ctx.fillRect(o.x+o.w-10, o.y+o.h, 8, 4);
                // Exhaust fire
                const exLen = 12+Math.random()*10;
                ctx.fillStyle='rgba(249,115,22,0.8)';
                ctx.beginPath(); ctx.moveTo(o.x+o.w,o.y+3); ctx.lineTo(o.x+o.w+exLen,o.y+o.h/2); ctx.lineTo(o.x+o.w,o.y+o.h-3); ctx.fill();
                ctx.fillStyle='rgba(253,224,71,0.6)';
                ctx.beginPath(); ctx.moveTo(o.x+o.w,o.y+5); ctx.lineTo(o.x+o.w+exLen*0.6,o.y+o.h/2); ctx.lineTo(o.x+o.w,o.y+o.h-5); ctx.fill();
            }
        } else {
            // Zapper
            ctx.save();
            const cx = o.x+o.w/2, cy = o.y+o.h/2;
            ctx.translate(cx, cy);
            ctx.rotate(o.angle||0);
            // Beam
            const grd = ctx.createLinearGradient(0,-o.h/2,0,o.h/2);
            grd.addColorStop(0,'rgba(239,68,68,0.2)');
            grd.addColorStop(0.5,'rgba(239,68,68,0.9)');
            grd.addColorStop(1,'rgba(239,68,68,0.2)');
            ctx.fillStyle=grd;
            ctx.fillRect(-o.w/2, -o.h/2, o.w, o.h);
            // Electric core
            ctx.strokeStyle=`rgba(255,200,200,${0.5+Math.random()*0.5})`;
            ctx.lineWidth=2;
            ctx.beginPath();
            const isH = o.w > o.h;
            const len = isH ? o.w : o.h;
            for(let i=0;i<len;i+=6){
                const px = isH ? -o.w/2+i : (Math.random()-0.5)*o.w*0.6;
                const py = isH ? (Math.random()-0.5)*o.h*1.5 : -o.h/2+i;
                if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
            }
            ctx.stroke();
            // End nodes
            ctx.fillStyle='#fca5a5';
            ctx.shadowColor='#ef4444'; ctx.shadowBlur=10;
            if(isH) {
                ctx.beginPath(); ctx.arc(-o.w/2, 0, 9, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(o.w/2, 0, 9, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.beginPath(); ctx.arc(0, -o.h/2, 9, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(0, o.h/2, 9, 0, Math.PI*2); ctx.fill();
            }
            ctx.shadowBlur=0;
            // Node inner
            ctx.fillStyle='#fff';
            if(isH) {
                ctx.beginPath(); ctx.arc(-o.w/2, 0, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(o.w/2, 0, 4, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.beginPath(); ctx.arc(0, -o.h/2, 4, 0, Math.PI*2); ctx.fill();
                ctx.beginPath(); ctx.arc(0, o.h/2, 4, 0, Math.PI*2); ctx.fill();
            }
            ctx.restore();
        }
    });
}

function drawPlayer() {
    const px = PLAYER_X, py = player.y;
    ctx.save();

    // Shadow on ground
    if (py < GROUND_Y - 30) {
        const shadowAlpha = Math.max(0, 0.2 - (GROUND_Y-py)*0.001);
        ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
        ctx.beginPath(); ctx.ellipse(px, GROUND_Y-2, 14, 4, 0, 0, Math.PI*2); ctx.fill();
    }

    // Jetpack (on back)
    ctx.fillStyle='#4b5563';
    ctx.fillRect(px-18, py-6, 8, 22);
    ctx.fillStyle='#6b7280';
    ctx.fillRect(px-17, py-4, 6, 6);
    ctx.fillRect(px-17, py+8, 6, 6);
    // Jetpack nozzle
    ctx.fillStyle='#374151';
    ctx.fillRect(px-16, py+16, 5, 6);

    // Legs
    ctx.fillStyle='#1e3a5f';
    const legOff1 = player.running ? Math.sin(player.legPhase)*5 : 0;
    const legOff2 = player.running ? Math.sin(player.legPhase+Math.PI)*5 : 0;
    // Left leg
    ctx.fillRect(px-6, py+12, 6, 12+legOff1);
    // Right leg
    ctx.fillRect(px+1, py+12, 6, 12+legOff2);
    // Boots
    ctx.fillStyle='#1f2937';
    ctx.fillRect(px-7, py+22+Math.max(0,legOff1), 8, 4);
    ctx.fillRect(px, py+22+Math.max(0,legOff2), 8, 4);

    // Body (lab coat / suit)
    ctx.fillStyle='#e5e7eb';
    ctx.fillRect(px-8, py-10, 18, 24);
    // Body shading
    ctx.fillStyle='rgba(0,0,0,0.1)';
    ctx.fillRect(px+4, py-10, 6, 24);
    // Belt
    ctx.fillStyle='#374151';
    ctx.fillRect(px-8, py+10, 18, 3);
    // Collar
    ctx.fillStyle='#d1d5db';
    ctx.fillRect(px-5, py-10, 12, 4);

    // Arms
    const armAngle = holding ? -0.4 : 0.2;
    ctx.fillStyle='#e5e7eb';
    // Left arm (holding jetpack strap)
    ctx.fillRect(px-12, py-4, 5, 14);
    // Right arm
    ctx.save();
    ctx.translate(px+10, py-2);
    ctx.rotate(armAngle);
    ctx.fillRect(0, 0, 5, 14);
    ctx.restore();

    // Head
    ctx.fillStyle='#fde68a';
    ctx.beginPath(); ctx.arc(px+1, py-18, 10, 0, Math.PI*2); ctx.fill();
    // Hair
    ctx.fillStyle='#92400e';
    ctx.beginPath(); ctx.arc(px+1, py-22, 8, Math.PI, 0); ctx.fill();
    ctx.fillRect(px-7, py-22, 3, 6);
    // Face
    ctx.fillStyle='#000';
    ctx.beginPath(); ctx.arc(px-2, py-18, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(px+5, py-18, 1.5, 0, Math.PI*2); ctx.fill();
    // Goggles
    ctx.strokeStyle='#60a5fa';
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(px-2, py-18, 4, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(px+5, py-18, 4, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle='#93c5fd'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(px+1, py-18); ctx.lineTo(px+2, py-18); ctx.stroke();
    // Goggle lens shine
    ctx.fillStyle='rgba(147,197,253,0.4)';
    ctx.beginPath(); ctx.arc(px-3, py-19, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(px+4, py-19, 2, 0, Math.PI*2); ctx.fill();
    // Mouth
    ctx.fillStyle = holding ? '#ef4444' : '#92400e';
    ctx.beginPath(); ctx.arc(px+1, py-14, holding?2.5:1.5, 0, Math.PI); ctx.fill();

    // Jetpack thrust fire
    if (holding && gameState==='playing') {
        const fireLen = 15 + Math.random()*12;
        const fireW = 6 + Math.random()*3;
        // Outer fire
        ctx.fillStyle = 'rgba(249,115,22,0.8)';
        ctx.beginPath();
        ctx.moveTo(px-15, py+22);
        ctx.quadraticCurveTo(px-13, py+22+fireLen*0.6, px-13-fireW/2, py+22+fireLen);
        ctx.quadraticCurveTo(px-13, py+22+fireLen*0.8, px-11, py+22);
        ctx.fill();
        // Inner fire
        ctx.fillStyle = 'rgba(253,224,71,0.9)';
        ctx.beginPath();
        ctx.moveTo(px-14, py+22);
        ctx.quadraticCurveTo(px-13, py+22+fireLen*0.4, px-13, py+22+fireLen*0.6);
        ctx.quadraticCurveTo(px-13, py+22+fireLen*0.3, px-12, py+22);
        ctx.fill();
    }

    ctx.restore();
}

function drawParticles() {
    particles.forEach(p => {
        if(p.size<=0) return;
        ctx.globalAlpha = Math.min(1, p.life * 2);
        if (p.type==='smoke') {
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x-p.size/2, p.y-p.size/2, p.size, p.size);
        }
    });
    ctx.globalAlpha = 1;
}

// ===== LOOP =====
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

newGame();
loop();
