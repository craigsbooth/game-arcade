// ===== DOODLE JUMP =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 360, H = 560;
canvas.width = W; canvas.height = H;

let player, platforms, score, best, gameOver, cameraY;
best = parseInt(localStorage.getItem('doodle-best')||'0');

function newGame() {
    player = {x:W/2-15,y:H-60,vy:0,vx:0,w:30,h:30,dir:1};
    platforms = [];
    // Initial platforms
    for(let i=0;i<8;i++) platforms.push({x:Math.random()*(W-60),y:H-i*70,w:60,type:'normal'});
    platforms[0].x = W/2-30; // starting platform
    score=0; gameOver=false; cameraY=0;
    document.getElementById('score-display').textContent='0';
}

// Input
let keys={};
document.addEventListener('keydown',e=>{keys[e.key]=true;});
document.addEventListener('keyup',e=>{keys[e.key]=false;});
// Tilt on mobile
let tiltX = 0;
window.addEventListener('deviceorientation',e=>{ if(e.gamma) tiltX=e.gamma/30; });
// Touch sides
canvas.addEventListener('touchstart',e=>{
    e.preventDefault();
    const x=e.touches[0].clientX-canvas.getBoundingClientRect().left;
    if(x<W/2) keys['ArrowLeft']=true; else keys['ArrowRight']=true;
});
canvas.addEventListener('touchend',e=>{e.preventDefault();keys['ArrowLeft']=false;keys['ArrowRight']=false;});

function update() {
    if(gameOver) return;

    // Horizontal movement
    if(keys['ArrowLeft']||keys['a']) player.vx-=0.5;
    if(keys['ArrowRight']||keys['d']) player.vx+=0.5;
    player.vx += tiltX*0.3;
    player.vx *= 0.9;
    player.x += player.vx;
    // Wrap
    if(player.x+player.w<0) player.x=W;
    if(player.x>W) player.x=-player.w;

    player.dir = player.vx>=0?1:-1;

    // Gravity
    player.vy += 0.4;
    player.y += player.vy;

    // Platform collision (only when falling)
    if(player.vy>0) {
        platforms.forEach(p=>{
            if(player.x+player.w>p.x && player.x<p.x+p.w &&
               player.y+player.h>p.y && player.y+player.h<p.y+10) {
                player.vy = p.type==='spring'?-18:-11;
            }
        });
    }

    // Camera follows player up
    if(player.y < cameraY+H*0.4) {
        const shift = (cameraY+H*0.4)-player.y;
        cameraY -= shift;
        score = Math.max(score, Math.floor(-cameraY/10));
        document.getElementById('score-display').textContent = score;

        // Remove platforms below screen
        platforms = platforms.filter(p=>p.y < cameraY+H+50);

        // Generate new platforms
        while(platforms.length<10) {
            const lastY = platforms.length>0?Math.min(...platforms.map(p=>p.y)):cameraY;
            const gap = 50+Math.random()*40 + score*0.1;
            const newY = lastY - gap;
            const type = Math.random()<0.1?'spring':Math.random()<0.15?'breaking':'normal';
            platforms.push({x:Math.random()*(W-60), y:newY, w:60, type, broken:false});
        }
    }

    // Fall off screen = game over
    if(player.y > cameraY+H+50) {
        gameOver=true;
        if(score>best){best=score;localStorage.setItem('doodle-best',String(best));}
        showHighScores('doodle',score);
    }
}

function draw() {
    // Background
    ctx.fillStyle='#f5f0d0';
    ctx.fillRect(0,0,W,H);
    // Grid lines (notebook style)
    ctx.strokeStyle='rgba(0,0,0,0.04)';
    ctx.lineWidth=1;
    for(let y=0;y<H;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.strokeStyle='rgba(200,100,100,0.1)';
    ctx.beginPath();ctx.moveTo(40,0);ctx.lineTo(40,H);ctx.stroke();

    // Platforms
    platforms.forEach(p=>{
        const sy = p.y - cameraY;
        if(sy<-20||sy>H+20) return;
        if(p.type==='normal') {
            ctx.fillStyle='#4ade80';
            ctx.fillRect(p.x, sy, p.w, 10);
            ctx.fillStyle='#22c55e';
            ctx.fillRect(p.x, sy+8, p.w, 4);
        } else if(p.type==='spring') {
            ctx.fillStyle='#4ade80';
            ctx.fillRect(p.x, sy, p.w, 10);
            ctx.fillStyle='#f59e0b';
            ctx.fillRect(p.x+p.w/2-4, sy-8, 8, 8);
        } else if(p.type==='breaking') {
            ctx.fillStyle=p.broken?'rgba(139,92,42,0.3)':'#c4a35a';
            if(!p.broken){ctx.fillRect(p.x,sy,p.w,10);ctx.strokeStyle='#92750e';ctx.lineWidth=1;ctx.strokeRect(p.x,sy,p.w,10);}
        }
    });

    // Player (doodle character)
    const sy = player.y - cameraY;
    ctx.fillStyle='#65a30d';
    ctx.fillRect(player.x+4, sy+4, player.w-8, player.h-8);
    // Face
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.arc(player.x+player.w/2+(player.dir*4), sy+12, 4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#000';
    ctx.beginPath();ctx.arc(player.x+player.w/2+(player.dir*5), sy+12, 2,0,Math.PI*2);ctx.fill();
    // Nose/beak
    ctx.fillStyle='#f97316';
    ctx.fillRect(player.x+player.w/2+(player.dir*8), sy+14, 6*player.dir, 4);
    // Feet
    ctx.fillStyle='#65a30d';
    ctx.fillRect(player.x+6, sy+player.h-6, 6, 6);
    ctx.fillRect(player.x+player.w-12, sy+player.h-6, 6, 6);

    // Game over
    if(gameOver){
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,W,H);
        ctx.fillStyle='#fff';ctx.font='bold 24px "Fredoka One"';ctx.textAlign='center';
        ctx.fillText('GAME OVER',W/2,H/2-10);
        ctx.font='14px Nunito';
        ctx.fillText(`Score: ${score} | Best: ${best}`,W/2,H/2+20);
        ctx.fillText('Tap to retry',W/2,H/2+45);
    }
}

canvas.addEventListener('click',()=>{if(gameOver)newGame();});

function loop(){update();draw();requestAnimationFrame(loop);}
newGame();loop();
