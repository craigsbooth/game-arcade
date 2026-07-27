// ===== SUPER MARIO RUN =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 640, H = 360;
canvas.width = W; canvas.height = H;

const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const GROUND_Y = H - 48;
const RUN_SPEED = 4;

let player, obstacles, coins, platforms, particles;
let score, coinCount, distance, speed, gameState, frame;
let best = parseInt(localStorage.getItem('mario-best')||'0');

// Ground tiles
const groundPattern = [];
for(let i=0;i<30;i++) groundPattern.push({x:i*32});

// Clouds
const clouds = [];
for(let i=0;i<6;i++) clouds.push({x:i*140+Math.random()*60, y:30+Math.random()*50, w:50+Math.random()*30});

// Hills
const hills = [{x:0,w:200,h:60},{x:300,w:150,h:45},{x:550,w:180,h:55}];

// Input
let jumpHeld = false;
document.addEventListener('keydown', e => {
    if(e.key===' '||e.key==='ArrowUp') { e.preventDefault(); doJump(); }
});
document.addEventListener('keyup', e => { if(e.key===' '||e.key==='ArrowUp') jumpHeld=false; });
canvas.addEventListener('mousedown', e => { e.preventDefault(); doJump(); });
canvas.addEventListener('mouseup', () => jumpHeld=false);
canvas.addEventListener('touchstart', e => { e.preventDefault(); doJump(); });
canvas.addEventListener('touchend', e => { e.preventDefault(); jumpHeld=false; });
document.getElementById('retry-btn').addEventListener('click', newGame);

function doJump() {
    if(gameState==='dead') return;
    if(gameState==='ready') { gameState='playing'; document.getElementById('start-msg').classList.add('hidden'); }
    if(player.grounded) {
        player.vy = JUMP_FORCE;
        player.grounded = false;
        jumpHeld = true;
    }
}

function newGame() {
    player = {x:80, y:GROUND_Y-32, vy:0, w:24, h:32, grounded:true, runFrame:0};
    obstacles = [];
    coins = [];
    platforms = [];
    particles = [];
    score = 0; coinCount = 0; distance = 0; speed = RUN_SPEED; frame = 0;
    gameState = 'ready';
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('start-msg').classList.remove('hidden');
    document.getElementById('score').textContent = '0';
    document.getElementById('coins').textContent = '0';
}

function spawnObstacle() {
    const types = ['goomba','pipe_s','pipe_l','gap'];
    const type = types[Math.floor(Math.random()*types.length)];
    const x = W + 20;
    if(type==='goomba') obstacles.push({type,x,y:GROUND_Y-20,w:20,h:20});
    else if(type==='pipe_s') obstacles.push({type,x,y:GROUND_Y-36,w:32,h:36});
    else if(type==='pipe_l') obstacles.push({type,x,y:GROUND_Y-56,w:32,h:56});
    else if(type==='gap') obstacles.push({type,x,y:GROUND_Y,w:48,h:200});
}

function spawnCoins() {
    const x = W + 20;
    const pattern = Math.floor(Math.random()*3);
    for(let i=0;i<3;i++) {
        let cy = GROUND_Y - 60 - (pattern===1?i*25:0);
        if(pattern===2) cy = GROUND_Y - 80 + Math.sin(i)*20;
        coins.push({x:x+i*28, y:cy, collected:false, bob:Math.random()*Math.PI*2});
    }
}

function update() {
    if(gameState!=='playing') {
        if(gameState==='ready') player.runFrame+=0.15;
        return;
    }
    frame++;
    distance += speed;
    score = Math.floor(distance/10);
    speed = RUN_SPEED + distance*0.0003;
    document.getElementById('score').textContent = score;
    player.runFrame += 0.2;

    // Gravity
    player.vy += GRAVITY;
    // Variable jump height
    if(jumpHeld && player.vy<0) player.vy += GRAVITY*0.3; // slightly less gravity while holding
    else if(!jumpHeld && player.vy<-4) player.vy = -4; // cut jump short

    player.y += player.vy;

    // Ground
    let onGround = false;
    // Check if over a gap
    let overGap = false;
    obstacles.forEach(o => {
        if(o.type==='gap' && player.x+player.w>o.x+8 && player.x<o.x+o.w-8) overGap=true;
    });

    if(!overGap && player.y >= GROUND_Y-player.h) {
        player.y = GROUND_Y-player.h;
        player.vy = 0;
        player.grounded = true;
        onGround = true;
    }

    // Fall in gap
    if(player.y > H+50) { die(); return; }

    // Spawn
    if(frame%90===0) spawnObstacle();
    if(frame%70===0) spawnCoins();

    // Move obstacles
    obstacles.forEach(o => { o.x -= speed; });
    obstacles = obstacles.filter(o => o.x+o.w > -50);

    // Move coins
    coins.forEach(c => { c.x -= speed; c.bob+=0.08; });
    coins = coins.filter(c => c.x > -20);

    // Collision with obstacles (not gaps)
    obstacles.forEach(o => {
        if(o.type==='gap') return;
        if(player.x+player.w-4>o.x && player.x+4<o.x+o.w &&
           player.y+player.h>o.y && player.y<o.y+o.h) {
            // Stomp check for goombas
            if(o.type==='goomba' && player.vy>0 && player.y+player.h<o.y+o.h/2+5) {
                player.vy = -8; // bounce
                o.x = -100; // remove
                score += 100;
                spawnStompParticles(o.x, o.y);
            } else {
                die();
            }
        }
    });

    // Coin collection
    coins.forEach(c => {
        if(c.collected) return;
        if(Math.abs(player.x+player.w/2-c.x)<18 && Math.abs(player.y+player.h/2-c.y)<18) {
            c.collected=true;
            coinCount++;
            score+=50;
            document.getElementById('coins').textContent=coinCount;
            particles.push({x:c.x,y:c.y,vy:-3,life:0.8,text:'+50'});
        }
    });

    // Scroll background
    groundPattern.forEach(g => { g.x-=speed; if(g.x<-32) g.x+=30*32; });
    clouds.forEach(c => { c.x-=speed*0.2; if(c.x+c.w<-20) c.x=W+20; });
    hills.forEach(h => { h.x-=speed*0.4; if(h.x+h.w<-20) h.x=W+Math.random()*100; });

    // Particles
    particles=particles.filter(p=>p.life>0);
    particles.forEach(p=>{p.y+=p.vy||0;p.life-=0.03;});
}

function die() {
    gameState='dead';
    player.vy=-8;
    if(score>best){best=score;localStorage.setItem('mario-best',String(best));}
    document.getElementById('ov-stats').textContent=`Score: ${score} | Coins: ${coinCount}`;
    setTimeout(()=>{
        document.getElementById('overlay').classList.remove('hidden');
        showHighScores('mario',score);
    },800);
}

function spawnStompParticles(x,y) {
    for(let i=0;i<5;i++) particles.push({x:x+Math.random()*20,y:y,vy:-2-Math.random()*2,life:0.6,color:'#8b4513'});
}

// ===== RENDER =====
function draw() {
    // Sky
    const sky = ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#5c94fc');
    sky.addColorStop(1,'#88b4fc');
    ctx.fillStyle = sky;
    ctx.fillRect(0,0,W,H);

    // Clouds
    ctx.fillStyle='rgba(255,255,255,0.9)';
    clouds.forEach(c => {
        ctx.beginPath();
        ctx.arc(c.x,c.y,c.w*0.3,0,Math.PI*2);
        ctx.arc(c.x+c.w*0.3,c.y-5,c.w*0.25,0,Math.PI*2);
        ctx.arc(c.x+c.w*0.6,c.y,c.w*0.28,0,Math.PI*2);
        ctx.fill();
    });

    // Hills
    hills.forEach(h => {
        ctx.fillStyle='#2d8a4e';
        ctx.beginPath();
        ctx.moveTo(h.x,GROUND_Y);
        ctx.quadraticCurveTo(h.x+h.w/2,GROUND_Y-h.h,h.x+h.w,GROUND_Y);
        ctx.fill();
        ctx.fillStyle='#3da85e';
        ctx.beginPath();
        ctx.moveTo(h.x+h.w*0.2,GROUND_Y);
        ctx.quadraticCurveTo(h.x+h.w/2,GROUND_Y-h.h*0.7,h.x+h.w*0.8,GROUND_Y);
        ctx.fill();
    });

    // Ground
    ctx.fillStyle='#c84c0c';
    ctx.fillRect(0,GROUND_Y,W,48);
    ctx.fillStyle='#e09050';
    ctx.fillRect(0,GROUND_Y,W,4);
    // Bricks
    ctx.strokeStyle='rgba(0,0,0,0.1)';
    ctx.lineWidth=1;
    groundPattern.forEach(g => {
        ctx.strokeRect(g.x,GROUND_Y+4,32,16);
        ctx.strokeRect(g.x+8,GROUND_Y+20,32,16);
    });

    // Draw gaps (erase ground)
    obstacles.forEach(o => {
        if(o.type==='gap') {
            ctx.fillStyle=sky;
            ctx.fillRect(o.x,GROUND_Y,o.w,48);
            // Cliff edges
            ctx.fillStyle='#8b4513';
            ctx.fillRect(o.x-3,GROUND_Y,3,48);
            ctx.fillRect(o.x+o.w,GROUND_Y,3,48);
        }
    });

    // Obstacles
    obstacles.forEach(o => {
        if(o.type==='goomba') drawGoomba(o.x, o.y);
        else if(o.type==='pipe_s'||o.type==='pipe_l') drawPipe(o.x, o.y, o.w, o.h);
    });

    // Coins
    coins.forEach(c => {
        if(c.collected) return;
        const cy = c.y + Math.sin(c.bob)*3;
        ctx.fillStyle='#fbbf24';
        ctx.beginPath(); ctx.arc(c.x,cy,8,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#f59e0b';
        ctx.beginPath(); ctx.arc(c.x,cy,5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.4)';
        ctx.beginPath(); ctx.arc(c.x-2,cy-2,2.5,0,Math.PI*2); ctx.fill();
    });

    // Player (Mario)
    drawMario(player.x, player.y);

    // Particles
    particles.forEach(p => {
        if(p.text) {
            ctx.fillStyle=`rgba(255,255,255,${p.life})`;
            ctx.font='bold 14px Nunito';ctx.textAlign='center';
            ctx.fillText(p.text,p.x,p.y);
        } else {
            ctx.fillStyle=p.color||'#fff';
            ctx.globalAlpha=p.life;
            ctx.fillRect(p.x-2,p.y-2,4,4);
            ctx.globalAlpha=1;
        }
    });

    // Game over death animation
    if(gameState==='dead') {
        player.y+=player.vy; player.vy+=0.3;
    }
}

function drawMario(x, y) {
    const f = Math.floor(player.runFrame) % 3;
    // Hat
    ctx.fillStyle='#e00000';
    ctx.fillRect(x+4,y,18,8);
    ctx.fillRect(x+2,y+2,22,6);
    // Face
    ctx.fillStyle='#ffb07c';
    ctx.fillRect(x+4,y+8,16,10);
    // Eyes
    ctx.fillStyle='#000';
    ctx.fillRect(x+14,y+10,3,3);
    // Mustache
    ctx.fillStyle='#4a2800';
    ctx.fillRect(x+8,y+14,12,3);
    // Body (overalls)
    ctx.fillStyle='#0000e0';
    ctx.fillRect(x+4,y+18,16,10);
    // Shirt
    ctx.fillStyle='#e00000';
    ctx.fillRect(x+2,y+18,4,8);
    ctx.fillRect(x+18,y+18,4,8);
    // Buttons
    ctx.fillStyle='#fbbf24';
    ctx.fillRect(x+9,y+20,2,2);
    ctx.fillRect(x+13,y+20,2,2);
    // Legs
    ctx.fillStyle='#0000e0';
    if(!player.grounded) {
        // Jumping pose
        ctx.fillRect(x+4,y+28,6,4);
        ctx.fillRect(x+14,y+28,6,4);
    } else {
        // Running animation
        if(f===0) { ctx.fillRect(x+3,y+28,7,4); ctx.fillRect(x+14,y+28,7,4); }
        else if(f===1) { ctx.fillRect(x+1,y+28,7,4); ctx.fillRect(x+16,y+28,7,4); }
        else { ctx.fillRect(x+5,y+28,6,4); ctx.fillRect(x+13,y+28,6,4); }
    }
    // Shoes
    ctx.fillStyle='#6b2f00';
    ctx.fillRect(x+2,y+30,8,2);
    ctx.fillRect(x+14,y+30,8,2);
}

function drawGoomba(x, y) {
    // Brown mushroom enemy
    ctx.fillStyle='#8b4513';
    ctx.beginPath(); ctx.arc(x+10,y+6,10,Math.PI,0); ctx.fill();
    ctx.fillStyle='#d2691e';
    ctx.fillRect(x+3,y+6,14,14);
    // Eyes
    ctx.fillStyle='#fff';
    ctx.fillRect(x+4,y+6,4,5);
    ctx.fillRect(x+12,y+6,4,5);
    ctx.fillStyle='#000';
    ctx.fillRect(x+5,y+8,2,3);
    ctx.fillRect(x+13,y+8,2,3);
    // Feet
    ctx.fillStyle='#000';
    ctx.fillRect(x+2,y+18,6,3);
    ctx.fillRect(x+12,y+18,6,3);
}

function drawPipe(x, y, w, h) {
    // Green pipe
    ctx.fillStyle='#00a800';
    ctx.fillRect(x+2,y+10,w-4,h-10);
    // Pipe top (wider)
    ctx.fillStyle='#00c800';
    ctx.fillRect(x-2,y,w+4,12);
    // Highlight
    ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.fillRect(x+4,y+10,6,h-12);
    // Dark edge
    ctx.fillStyle='rgba(0,0,0,0.2)';
    ctx.fillRect(x+w-6,y+10,4,h-10);
    // Top highlight
    ctx.fillStyle='rgba(255,255,255,0.2)';
    ctx.fillRect(x,y,w,3);
}

// ===== LOOP =====
function loop() { update(); draw(); requestAnimationFrame(loop); }
newGame(); loop();
