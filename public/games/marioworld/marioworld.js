// ===== SUPER MARIO WORLD =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 640, H = 360;
canvas.width = W; canvas.height = H;
const T = 32; // tile size

// Level map: . = air, # = ground, B = brick, ? = question block,
// P = pipe-top, p = pipe-body, G = goomba spawn, K = koopa spawn,
// C = coin, F = flag, S = start
const LEVEL = [
    '............................................................................F',
    '............................................................................|',
    '.....................C.C.C.........?...........C.C.C.C.......................|',
    '..............................................####..........................|',
    '..........?..B?B?B..........??...........G.............??B??......K.........|',
    '.....................................................................###...|',
    '....G...........G.......G........G..###......G.....G................###...|.',
    '################..######..####..###########..####..####..######..#########.##',
    '################..######..####..###########..####..####..######..############',
];

const ROWS = LEVEL.length, COLS = LEVEL[0].length;

// State
let map, player, enemies, coinItems, particles, camera;
let keys={}, coinCount, lives, gameState;

// Input
document.addEventListener('keydown',e=>{keys[e.key]=true;if(e.key===' '||e.key==='ArrowUp')e.preventDefault();});
document.addEventListener('keyup',e=>{keys[e.key]=false;});
// Mobile
const mLeft=document.getElementById('m-left'),mRight=document.getElementById('m-right'),mJump=document.getElementById('m-jump');
mLeft.addEventListener('touchstart',e=>{e.preventDefault();keys['ArrowLeft']=true;});
mLeft.addEventListener('touchend',e=>{e.preventDefault();keys['ArrowLeft']=false;});
mRight.addEventListener('touchstart',e=>{e.preventDefault();keys['ArrowRight']=true;});
mRight.addEventListener('touchend',e=>{e.preventDefault();keys['ArrowRight']=false;});
mJump.addEventListener('touchstart',e=>{e.preventDefault();keys[' ']=true;});
mJump.addEventListener('touchend',e=>{e.preventDefault();keys[' ']=false;});
document.getElementById('ov-btn').addEventListener('click',()=>{newGame();});

function initLevel() {
    map=[]; enemies=[]; coinItems=[]; particles=[];
    for(let r=0;r<ROWS;r++) {
        map[r]=[];
        for(let c=0;c<COLS;c++) {
            const ch=LEVEL[r][c];
            map[r][c] = ch==='#'?'ground':ch==='B'?'brick':ch==='?'?'question':ch==='P'?'pipetop':ch==='p'?'pipe':ch==='F'?'flag':ch==='|'?'flagpole':'.';
            if(ch==='G') enemies.push({x:c*T,y:r*T,w:T-4,h:T-4,vx:-1,type:'goomba',alive:true,frame:0});
            if(ch==='K') enemies.push({x:c*T,y:r*T,w:T-4,h:T-4,vx:-1,type:'koopa',alive:true,frame:0});
            if(ch==='C') coinItems.push({x:c*T+T/2,y:r*T+T/2,collected:false,bob:Math.random()*Math.PI*2});
        }
    }
}

function newGame() {
    coinCount=0; lives=3; gameState='playing';
    document.getElementById('coins').textContent='0';
    document.getElementById('lives').textContent=lives;
    document.getElementById('overlay').classList.add('hidden');
    initLevel();
    player={x:2*T,y:6*T,vx:0,vy:0,w:22,h:30,grounded:false,dir:1,frame:0,dead:false};
    camera={x:0};
}

function isSolid(c,r) {
    if(r<0||r>=ROWS||c<0||c>=COLS) return r>=ROWS-2; // below map = solid
    const t=map[r][c];
    return t==='ground'||t==='brick'||t==='question'||t==='pipetop'||t==='pipe';
}

function hitBlock(c,r) {
    if(r<0||r>=ROWS||c<0||c>=COLS) return;
    if(map[r][c]==='question') {
        map[r][c]='used';
        coinCount++; document.getElementById('coins').textContent=coinCount;
        particles.push({x:c*T+T/2,y:r*T-10,vy:-4,life:1,text:'🪙'});
    } else if(map[r][c]==='brick') {
        map[r][c]='.';
        for(let i=0;i<4;i++) particles.push({x:c*T+Math.random()*T,y:r*T,vx:(Math.random()-0.5)*4,vy:-4-Math.random()*3,life:1,color:'#c84c0c',size:6});
    }
}

function update() {
    if(gameState!=='playing') return;
    if(player.dead) { player.vy+=0.3; player.y+=player.vy; if(player.y>H+100) respawn(); return; }

    // Horizontal movement
    const accel=0.4, maxSpeed=4.5, friction=0.85;
    if(keys['ArrowLeft']||keys['a']) { player.vx-=accel; player.dir=-1; }
    if(keys['ArrowRight']||keys['d']) { player.vx+=accel; player.dir=1; }
    if(!keys['ArrowLeft']&&!keys['a']&&!keys['ArrowRight']&&!keys['d']) player.vx*=friction;
    player.vx=Math.max(-maxSpeed,Math.min(maxSpeed,player.vx));
    player.frame+=Math.abs(player.vx)*0.1;

    // Jump
    if((keys[' ']||keys['ArrowUp']||keys['w'])&&player.grounded) { player.vy=-11; player.grounded=false; }
    // Variable jump
    if(!(keys[' ']||keys['ArrowUp']||keys['w'])&&player.vy<-3) player.vy=-3;

    // Gravity
    player.vy+=0.5;
    if(player.vy>12) player.vy=12;

    // Move X with collision
    player.x+=player.vx;
    resolveCollisionX();

    // Move Y with collision
    player.y+=player.vy;
    player.grounded=false;
    resolveCollisionY();

    // Fall death
    if(player.y>ROWS*T+50) { die(); return; }

    // Camera
    camera.x = player.x - W*0.35;
    camera.x = Math.max(0, Math.min(COLS*T-W, camera.x));

    // Coin collection
    coinItems.forEach(c=>{
        if(c.collected) return;
        if(Math.abs(player.x+player.w/2-c.x)<20&&Math.abs(player.y+player.h/2-c.y)<20) {
            c.collected=true; coinCount++;
            document.getElementById('coins').textContent=coinCount;
            particles.push({x:c.x,y:c.y-10,vy:-2,life:0.8,text:'+1'});
        }
    });

    // Enemies
    enemies.forEach(e=>{
        if(!e.alive) return;
        e.x+=e.vx; e.frame+=0.05;
        // Reverse at walls
        const ec=Math.floor((e.x+e.w/2)/T), er=Math.floor((e.y+e.h)/T);
        if(isSolid(Math.floor(e.x/T)+Math.floor(e.vx>0?1:0), er-1)) e.vx*=-1;
        if(!isSolid(ec+Math.sign(e.vx), er)) e.vx*=-1; // don't walk off edges
        // Gravity
        if(!isSolid(ec, er)) e.y+=2;

        // Collision with player
        if(player.x+player.w>e.x&&player.x<e.x+e.w&&player.y+player.h>e.y&&player.y<e.y+e.h) {
            if(player.vy>0&&player.y+player.h<e.y+e.h/2+8) {
                // Stomp
                e.alive=false; player.vy=-7;
                particles.push({x:e.x+e.w/2,y:e.y,vy:-2,life:0.6,text:'💥'});
                coinCount+=5;document.getElementById('coins').textContent=coinCount;
            } else { die(); }
        }
    });

    // Flag (win)
    const px=Math.floor((player.x+player.w/2)/T);
    const py=Math.floor((player.y+player.h/2)/T);
    if(px>=0&&px<COLS&&py>=0&&py<ROWS&&(map[py][px]==='flag'||map[py][px]==='flagpole')) {
        gameState='won';
        document.getElementById('ov-title').textContent='LEVEL COMPLETE! 🎉';
        document.getElementById('ov-sub').textContent=`Coins: ${coinCount}`;
        document.getElementById('overlay').classList.remove('hidden');
        showHighScores('marioworld', coinCount*100);
    }

    // Particles
    particles=particles.filter(p=>p.life>0);
    particles.forEach(p=>{if(p.vy!==undefined)p.y+=p.vy;if(p.vx)p.x+=p.vx;if(p.vy!==undefined&&!p.text)p.vy+=0.2;p.life-=0.02;});
}

function resolveCollisionX() {
    const left=Math.floor(player.x/T), right=Math.floor((player.x+player.w)/T);
    const top=Math.floor(player.y/T), bot=Math.floor((player.y+player.h-1)/T);
    for(let r=top;r<=bot;r++) {
        if(isSolid(left,r)&&player.vx<0) { player.x=(left+1)*T; player.vx=0; }
        if(isSolid(right,r)&&player.vx>0) { player.x=right*T-player.w-0.1; player.vx=0; }
    }
}
function resolveCollisionY() {
    const left=Math.floor(player.x/T), right=Math.floor((player.x+player.w-1)/T);
    const top=Math.floor(player.y/T), bot=Math.floor((player.y+player.h)/T);
    for(let c=left;c<=right;c++) {
        if(player.vy>0&&isSolid(c,bot)) { player.y=bot*T-player.h; player.vy=0; player.grounded=true; }
        if(player.vy<0&&isSolid(c,top)) { player.y=(top+1)*T; player.vy=1; hitBlock(c,top); }
    }
}

function die() { player.dead=true; player.vy=-8; lives--; document.getElementById('lives').textContent=Math.max(0,lives); }
function respawn() { if(lives<=0){gameState='dead';document.getElementById('ov-title').textContent='GAME OVER';document.getElementById('ov-sub').textContent=`Coins: ${coinCount}`;document.getElementById('overlay').classList.remove('hidden');showHighScores('marioworld',coinCount*100);} else{player.dead=false;player.x=2*T;player.y=6*T;player.vx=0;player.vy=0;}}

// ===== RENDER =====
function draw() {
    // Sky
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#5c94fc'); sky.addColorStop(1,'#92c4fc');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

    // Background clouds
    ctx.fillStyle='rgba(255,255,255,0.7)';
    for(let i=0;i<5;i++){
        const cx=((i*200-camera.x*0.2)%1200+1200)%1200-100;
        ctx.beginPath(); ctx.arc(cx,40+i*15,20,0,Math.PI*2); ctx.arc(cx+20,35+i*15,16,0,Math.PI*2); ctx.arc(cx+38,40+i*15,18,0,Math.PI*2); ctx.fill();
    }

    ctx.save(); ctx.translate(-camera.x, 0);

    // Tiles
    const startC=Math.max(0,Math.floor(camera.x/T)-1);
    const endC=Math.min(COLS,Math.ceil((camera.x+W)/T)+1);
    for(let r=0;r<ROWS;r++) for(let c=startC;c<endC;c++) {
        const t=map[r][c], x=c*T, y=r*T;
        if(t==='ground') { drawBrick(x,y,'#c84c0c','#e09050'); }
        else if(t==='brick') { drawBrick(x,y,'#c06000','#e08040'); ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=1;ctx.strokeRect(x,y,T,T); }
        else if(t==='question') { ctx.fillStyle='#fbbf24';ctx.fillRect(x,y,T,T);ctx.fillStyle='#f59e0b';ctx.fillRect(x+2,y+2,T-4,T-4);ctx.fillStyle='#fff';ctx.font='bold 18px Nunito';ctx.textAlign='center';ctx.fillText('?',x+T/2,y+T/2+6); }
        else if(t==='used') { ctx.fillStyle='#8b6914';ctx.fillRect(x,y,T,T);ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=1;ctx.strokeRect(x,y,T,T); }
        else if(t==='pipetop') { ctx.fillStyle='#00c800';ctx.fillRect(x-4,y,T+8,T);ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(x,y,6,T); }
        else if(t==='pipe') { ctx.fillStyle='#00a800';ctx.fillRect(x,y,T,T);ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(x+4,y,4,T); }
        else if(t==='flag') { ctx.fillStyle='#22c55e';ctx.fillRect(x+T/2-2,y,4,T*3);ctx.fillStyle='#ef4444';ctx.fillRect(x+T/2+2,y,20,14); }
        else if(t==='flagpole') { ctx.fillStyle='#22c55e';ctx.fillRect(x+T/2-2,y,4,T); }
    }

    // Coins
    coinItems.forEach(c=>{
        if(c.collected)return;
        c.bob+=0.04;
        const cy=c.y+Math.sin(c.bob)*3;
        ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.arc(c.x,cy,8,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#f59e0b';ctx.beginPath();ctx.arc(c.x,cy,5,0,Math.PI*2);ctx.fill();
    });

    // Enemies
    enemies.forEach(e=>{
        if(!e.alive)return;
        if(e.type==='goomba') {
            ctx.fillStyle='#8b4513';
            ctx.beginPath();ctx.arc(e.x+e.w/2,e.y+8,12,Math.PI,0);ctx.fill();
            ctx.fillStyle='#d2691e';ctx.fillRect(e.x+4,e.y+8,e.w-8,e.h-8);
            ctx.fillStyle='#fff';ctx.fillRect(e.x+6,e.y+8,4,4);ctx.fillRect(e.x+e.w-10,e.y+8,4,4);
            ctx.fillStyle='#000';ctx.fillRect(e.x+7,e.y+10,2,2);ctx.fillRect(e.x+e.w-9,e.y+10,2,2);
        } else {
            ctx.fillStyle='#16a34a';
            ctx.fillRect(e.x+4,e.y+4,e.w-8,e.h-4);
            ctx.fillStyle='#fbbf24';ctx.fillRect(e.x+6,e.y,e.w-12,8);
            ctx.fillStyle='#fff';ctx.fillRect(e.x+8,e.y+8,4,4);
            ctx.fillStyle='#000';ctx.fillRect(e.x+9,e.y+9,2,2);
        }
    });

    // Player
    if(!player.dead||player.y<H+50) drawPlayer(player.x,player.y);

    // Particles
    particles.forEach(p=>{
        if(p.text){ctx.fillStyle=`rgba(255,255,255,${Math.min(1,p.life*2)})`;ctx.font='bold 16px Nunito';ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y);}
        else if(p.color){ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size||4,p.size||4);ctx.globalAlpha=1;}
    });

    ctx.restore();
}

function drawBrick(x,y,c1,c2){
    ctx.fillStyle=c1;ctx.fillRect(x,y,T,T);
    ctx.fillStyle=c2;ctx.fillRect(x,y,T,2);ctx.fillRect(x,y,2,T);
}

function drawPlayer(x,y) {
    const f=Math.floor(player.frame)%3;
    const dir=player.dir;
    ctx.save(); ctx.translate(x+player.w/2, y);
    if(dir<0) ctx.scale(-1,1);
    ctx.translate(-player.w/2, 0);
    // Hat
    ctx.fillStyle='#e00000';ctx.fillRect(2,0,18,7);ctx.fillRect(0,2,22,5);
    // Face
    ctx.fillStyle='#ffb07c';ctx.fillRect(3,7,16,10);
    // Eye
    ctx.fillStyle='#000';ctx.fillRect(13,9,3,3);
    // Mustache
    ctx.fillStyle='#4a2800';ctx.fillRect(7,13,11,3);
    // Body
    ctx.fillStyle='#0000e0';ctx.fillRect(3,17,16,9);
    ctx.fillStyle='#e00000';ctx.fillRect(1,17,4,7);ctx.fillRect(17,17,4,7);
    // Legs
    ctx.fillStyle='#0000e0';
    if(!player.grounded){ctx.fillRect(3,26,6,4);ctx.fillRect(13,26,6,4);}
    else{const o=f===1?2:0;ctx.fillRect(2-o,26,7,4);ctx.fillRect(13+o,26,7,4);}
    ctx.fillStyle='#6b2f00';ctx.fillRect(1,29,8,2);ctx.fillRect(13,29,8,2);
    ctx.restore();
}

function loop(){update();draw();requestAnimationFrame(loop);}
newGame();loop();
