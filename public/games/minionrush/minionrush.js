// ===== MINION RUSH - 3 Lane Runner =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 400, H = 600;
canvas.width = W; canvas.height = H;

// 3 lanes
const LANE_W = W/3;
const LANES = [LANE_W*0.5, LANE_W*1.5, LANE_W*2.5];
const GROUND_Y = H - 100;
const PLAYER_SIZE = 40;

let player, obstacles, bananas, particles;
let lane, targetLane, score, bananaCount, speed, gameState, frame, best;
let jumping, sliding, jumpVY, playerY, slideTimer;
best = parseInt(localStorage.getItem('minionrush-best')||'0');

// Input
let swipeStartX=0, swipeStartY=0;
document.addEventListener('keydown', e => {
    if(e.key==='ArrowLeft'||e.key==='a') moveLane(-1);
    if(e.key==='ArrowRight'||e.key==='d') moveLane(1);
    if(e.key==='ArrowUp'||e.key==='w'||e.key===' ') { e.preventDefault(); jump(); }
    if(e.key==='ArrowDown'||e.key==='s') slide();
});
canvas.addEventListener('touchstart', e => { e.preventDefault(); const t=e.touches[0]; swipeStartX=t.clientX; swipeStartY=t.clientY; });
canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const t=e.changedTouches[0];
    const dx=t.clientX-swipeStartX, dy=t.clientY-swipeStartY;
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>30) moveLane(dx>0?1:-1);
    else if(dy<-30) jump();
    else if(dy>30) slide();
    else if(gameState==='ready') startGame();
});
canvas.addEventListener('click', ()=>{if(gameState==='ready')startGame();});
document.getElementById('retry-btn').addEventListener('click', newGame);

function moveLane(dir) {
    if(gameState==='ready') startGame();
    if(gameState!=='playing') return;
    targetLane = Math.max(0, Math.min(2, targetLane+dir));
}
function jump() {
    if(gameState==='ready') startGame();
    if(gameState!=='playing'||jumping||sliding) return;
    jumping=true; jumpVY=-14;
}
function slide() {
    if(gameState==='ready') startGame();
    if(gameState!=='playing'||jumping||sliding) return;
    sliding=true; slideTimer=30;
}
function startGame() { gameState='playing'; document.getElementById('start-msg').classList.add('hidden'); }

function newGame() {
    lane=1; targetLane=1; score=0; bananaCount=0; speed=6; frame=0;
    jumping=false; sliding=false; jumpVY=0; playerY=GROUND_Y-PLAYER_SIZE; slideTimer=0;
    obstacles=[]; bananas=[]; particles=[]; gameState='ready';
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('start-msg').classList.remove('hidden');
    document.getElementById('bananas').textContent='0';
    document.getElementById('dist').textContent='0';
}

function spawn() {
    // Obstacles
    if(Math.random()<0.03+speed*0.002) {
        const l=Math.floor(Math.random()*3);
        const types=['box','barrier','low'];
        const type=types[Math.floor(Math.random()*types.length)];
        let h=PLAYER_SIZE, y=GROUND_Y-h;
        if(type==='low'){h=20;y=GROUND_Y-20;} // slide under
        if(type==='barrier'){h=60;y=GROUND_Y-60;}
        obstacles.push({x:LANES[l],y:y,w:LANE_W*0.6,h,lane:l,type});
    }
    // Bananas
    if(Math.random()<0.05) {
        const l=Math.floor(Math.random()*3);
        const bY = jumping ? GROUND_Y-80-Math.random()*40 : GROUND_Y-PLAYER_SIZE-10;
        bananas.push({x:LANES[l],y:bY-Math.random()*30,lane:l,collected:false});
    }
}

function update() {
    if(gameState!=='playing') return;
    frame++;
    score = Math.floor(frame*speed*0.01);
    speed = 6 + frame*0.002;
    document.getElementById('dist').textContent = score;

    // Smooth lane switching
    const targetX = LANES[targetLane];
    const currentX = LANES[lane];
    if(Math.abs(targetLane-lane)>0) lane=targetLane; // snap for now

    // Jump physics
    if(jumping) {
        playerY += jumpVY;
        jumpVY += 0.8;
        if(playerY >= GROUND_Y-PLAYER_SIZE) { playerY=GROUND_Y-PLAYER_SIZE; jumping=false; jumpVY=0; }
    }
    // Slide
    if(sliding) { slideTimer--; if(slideTimer<=0) sliding=false; }

    spawn();

    // Move obstacles toward player
    obstacles.forEach(o => { o.y += speed; });
    obstacles = obstacles.filter(o => o.y < H+50);

    // Move bananas
    bananas.forEach(b => { b.y += speed; });
    bananas = bananas.filter(b => b.y < H+50);

    // Collision
    const px = LANES[lane], py = playerY;
    const pw = PLAYER_SIZE*0.7, ph = sliding ? PLAYER_SIZE*0.4 : PLAYER_SIZE;
    const pTop = sliding ? GROUND_Y-ph : py;

    obstacles.forEach(o => {
        if(o.lane !== lane) return;
        const oTop = o.y, oBot = o.y+o.h;
        const pBot = pTop+ph;
        if(oBot > pTop+5 && oTop < pBot-5) {
            // Hit!
            if(o.type==='low' && sliding) return; // dodged by sliding
            if(o.type==='box' && jumping && py < o.y-10) return; // jumped over
            die();
        }
    });

    // Banana collection
    bananas.forEach(b => {
        if(b.collected||b.lane!==lane) return;
        if(Math.abs(b.y - py)<40) {
            b.collected=true; bananaCount++;
            document.getElementById('bananas').textContent=bananaCount;
            for(let i=0;i<4;i++) particles.push({x:LANES[b.lane],y:b.y,vx:(Math.random()-0.5)*4,vy:-3-Math.random()*2,life:0.7,color:'#fbbf24'});
        }
    });

    // Particles
    particles=particles.filter(p=>p.life>0);
    particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.life-=0.03;});
}

function die() {
    gameState='dead';
    const total=score+bananaCount*10;
    if(total>best){best=total;localStorage.setItem('minionrush-best',String(best));}
    document.getElementById('ov-stats').textContent=`Distance: ${score}m | Bananas: ${bananaCount}`;
    document.getElementById('overlay').classList.remove('hidden');
    showHighScores('minionrush',total);
}

// ===== RENDER =====
function draw() {
    // Background gradient (purple lab)
    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#2d1b69'); bg.addColorStop(0.7,'#1a1040'); bg.addColorStop(1,'#0f0828');
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

    // Floor perspective lines
    ctx.strokeStyle='rgba(167,139,250,0.08)'; ctx.lineWidth=1;
    for(let i=0;i<10;i++){
        const fy=GROUND_Y+i*10;
        ctx.beginPath();ctx.moveTo(0,fy);ctx.lineTo(W,fy);ctx.stroke();
    }

    // Lane dividers
    ctx.strokeStyle='rgba(167,139,250,0.12)'; ctx.lineWidth=2; ctx.setLineDash([10,10]);
    ctx.beginPath();ctx.moveTo(LANE_W,GROUND_Y-200);ctx.lineTo(LANE_W,H);ctx.stroke();
    ctx.beginPath();ctx.moveTo(LANE_W*2,GROUND_Y-200);ctx.lineTo(LANE_W*2,H);ctx.stroke();
    ctx.setLineDash([]);

    // Ground
    ctx.fillStyle='#2a2060';
    ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);
    ctx.fillStyle='#3d3080'; ctx.fillRect(0,GROUND_Y,W,3);

    // Bananas
    bananas.forEach(b=>{
        if(b.collected)return;
        ctx.fillStyle='#fbbf24';
        ctx.beginPath();ctx.arc(b.x,b.y,10,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#92400e';
        ctx.beginPath();ctx.arc(b.x,b.y-8,3,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ca8a04';ctx.lineWidth=2;
        ctx.beginPath();ctx.arc(b.x,b.y,10,0.3,Math.PI-0.3);ctx.stroke();
    });

    // Obstacles
    obstacles.forEach(o=>{
        const ox=o.x-o.w/2;
        if(o.type==='box'){
            ctx.fillStyle='#7c2d12';ctx.fillRect(ox,o.y,o.w,o.h);
            ctx.strokeStyle='#451a03';ctx.lineWidth=2;ctx.strokeRect(ox,o.y,o.w,o.h);
            ctx.fillStyle='rgba(255,255,255,0.05)';ctx.fillRect(ox,o.y,o.w,3);
            ctx.fillStyle='#92400e';ctx.fillRect(ox+o.w*0.3,o.y+o.h*0.3,o.w*0.4,o.h*0.4);
        } else if(o.type==='barrier') {
            ctx.fillStyle='#dc2626';ctx.fillRect(ox,o.y,o.w,o.h);
            ctx.fillStyle='#fbbf24';
            for(let i=0;i<3;i++) ctx.fillRect(ox,o.y+i*20,o.w,8);
            ctx.strokeStyle='#7f1d1d';ctx.lineWidth=2;ctx.strokeRect(ox,o.y,o.w,o.h);
        } else { // low obstacle
            ctx.fillStyle='#6b21a8';ctx.fillRect(ox,o.y,o.w,o.h);
            ctx.fillStyle='#a855f7';ctx.fillRect(ox+4,o.y+2,o.w-8,o.h-4);
            // Warning stripes
            ctx.fillStyle='rgba(0,0,0,0.2)';
            for(let i=0;i<o.w;i+=12) ctx.fillRect(ox+i,o.y,6,o.h);
        }
    });

    // Player (Minion)
    drawMinion(LANES[lane], playerY, sliding);

    // Particles
    particles.forEach(p=>{
        ctx.globalAlpha=p.life;ctx.fillStyle=p.color;
        ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();
    });
    ctx.globalAlpha=1;
}

function drawMinion(x, y, isSliding) {
    ctx.save(); ctx.translate(x, y);

    if(isSliding) {
        // Sliding pose (horizontal)
        ctx.fillStyle='#fbbf24'; // body
        ctx.fillRect(-20,PLAYER_SIZE-18,40,14);
        ctx.fillStyle='#0000cd'; // overalls
        ctx.fillRect(-18,PLAYER_SIZE-12,36,8);
        // Head
        ctx.fillStyle='#fbbf24';
        ctx.beginPath();ctx.arc(-12,PLAYER_SIZE-14,10,0,Math.PI*2);ctx.fill();
        // Goggle
        ctx.fillStyle='#888';ctx.fillRect(-16,PLAYER_SIZE-18,8,6);
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-12,PLAYER_SIZE-15,3,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#4a2800';ctx.beginPath();ctx.arc(-12,PLAYER_SIZE-15,1.5,0,Math.PI*2);ctx.fill();
    } else {
        // Standing minion
        const bounce = jumping?0:Math.sin(frame*0.2)*2;
        // Body (yellow capsule)
        ctx.fillStyle='#fbbf24';
        ctx.beginPath();ctx.arc(0,10+bounce,16,0,Math.PI*2);ctx.fill();
        ctx.fillRect(-16,10+bounce,32,22);
        ctx.beginPath();ctx.arc(0,32+bounce,16,0,Math.PI);ctx.fill();
        // Overalls (blue)
        ctx.fillStyle='#1d4ed8';
        ctx.fillRect(-14,24+bounce,28,14);
        ctx.fillStyle='#1e40af';
        ctx.fillRect(-10,22+bounce,6,4);ctx.fillRect(4,22+bounce,6,4); //straps
        // Goggle band
        ctx.fillStyle='#333';ctx.fillRect(-18,6+bounce,36,5);
        // Goggle
        ctx.fillStyle='#9ca3af';
        ctx.beginPath();ctx.arc(0,8+bounce,10,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#fff';
        ctx.beginPath();ctx.arc(0,8+bounce,7,0,Math.PI*2);ctx.fill();
        // Eye
        ctx.fillStyle='#6b3a00';
        ctx.beginPath();ctx.arc(0,8+bounce,4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#000';
        ctx.beginPath();ctx.arc(1,7+bounce,2,0,Math.PI*2);ctx.fill();
        // Mouth
        ctx.fillStyle='#000';
        ctx.beginPath();ctx.arc(0,20+bounce,5,0.2,Math.PI-0.2);ctx.stroke();
        // Hair
        ctx.strokeStyle='#333';ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(-2,-5+bounce);ctx.lineTo(-3,-10+bounce);ctx.stroke();
        ctx.beginPath();ctx.moveTo(2,-5+bounce);ctx.lineTo(4,-10+bounce);ctx.stroke();
        // Legs
        ctx.fillStyle='#1d4ed8';
        const legAnim = Math.sin(frame*0.3)*3;
        ctx.fillRect(-8,38+bounce,6,8+legAnim);
        ctx.fillRect(2,38+bounce,6,8-legAnim);
        // Shoes
        ctx.fillStyle='#1a1a1a';
        ctx.fillRect(-10,44+bounce+Math.max(0,legAnim),10,4);
        ctx.fillRect(1,44+bounce+Math.max(0,-legAnim),10,4);
        // Arms
        ctx.fillStyle='#fbbf24';
        ctx.fillRect(-20,18+bounce,6,12);
        ctx.fillRect(14,18+bounce,6,12);
        // Gloves
        ctx.fillStyle='#111';
        ctx.beginPath();ctx.arc(-17,30+bounce,4,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(17,30+bounce,4,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
}

function loop(){update();draw();requestAnimationFrame(loop);}
newGame();loop();
