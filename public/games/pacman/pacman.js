// ===== PAC-MAN =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const T = 20; // tile size

// Simplified 21x21 maze: 1=wall, 0=dot, 2=power, 3=empty, 4=ghost-house
const MAZE = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,1,1,1,0,1,0,1,1,1,1,0,1,1,0,1],
    [1,2,1,1,0,1,1,1,1,0,1,0,1,1,1,1,0,1,1,2,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,0,1],
    [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
    [1,1,1,1,0,1,1,1,1,3,1,3,1,1,1,1,0,1,1,1,1],
    [3,3,3,1,0,1,3,3,3,3,3,3,3,3,3,1,0,1,3,3,3],
    [1,1,1,1,0,1,3,1,1,4,4,4,1,1,3,1,0,1,1,1,1],
    [3,3,3,3,0,3,3,1,4,4,4,4,4,1,3,3,0,3,3,3,3],
    [1,1,1,1,0,1,3,1,1,1,1,1,1,1,3,1,0,1,1,1,1],
    [3,3,3,1,0,1,3,3,3,3,3,3,3,3,3,1,0,1,3,3,3],
    [1,1,1,1,0,1,3,1,1,1,1,1,1,1,3,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,1,1,1,0,1,0,1,1,1,1,0,1,1,0,1],
    [1,2,0,1,0,0,0,0,0,0,3,0,0,0,0,0,0,1,0,2,1],
    [1,1,0,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,0,1,1],
    [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
    [1,0,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const COLS = MAZE[0].length, ROWS = MAZE.length;
canvas.width = COLS*T; canvas.height = ROWS*T;

let map, pac, ghosts, score, lives, level, gameOver, dots, powerTime, tick;
const GHOST_COLORS = ['#ff0000','#ffb8ff','#00ffff','#ffb852'];
let dir={x:0,y:0}, nextDir={x:0,y:0}, moveTimer=0;

function isWalkable(c,r) {
    if(c<0||c>=COLS||r<0||r>=ROWS) return false;
    return map[r][c]!==1;
}

function initMap() {
    map = MAZE.map(row=>[...row]);
    dots=0;
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(map[r][c]===0||map[r][c]===2) dots++;
}

function newGame() {
    score=0; lives=3; level=1; gameOver=false; tick=0;
    document.getElementById('score').textContent='0';
    document.getElementById('lives').textContent='●●●';
    document.getElementById('level').textContent='1';
    initMap(); resetLevel();
}

function resetLevel() {
    pac = {x:10, y:16, tx:10, ty:16, moving:false, anim:0};
    dir={x:0,y:0}; nextDir={x:0,y:0}; moveTimer=0; powerTime=0;
    ghosts = [
        {x:10,y:9, tx:10,ty:9, dx:1,dy:0, color:GHOST_COLORS[0], scared:false, moving:false},
        {x:9,y:10, tx:9,ty:10, dx:0,dy:-1, color:GHOST_COLORS[1], scared:false, moving:false},
        {x:10,y:10, tx:10,ty:10, dx:0,dy:1, color:GHOST_COLORS[2], scared:false, moving:false},
        {x:11,y:10, tx:11,ty:10, dx:1,dy:0, color:GHOST_COLORS[3], scared:false, moving:false},
    ];
}

// Input
document.addEventListener('keydown', e => {
    if(e.key==='ArrowLeft'||e.key==='a') { nextDir={x:-1,y:0}; e.preventDefault(); }
    if(e.key==='ArrowRight'||e.key==='d') { nextDir={x:1,y:0}; e.preventDefault(); }
    if(e.key==='ArrowUp'||e.key==='w') { nextDir={x:0,y:-1}; e.preventDefault(); }
    if(e.key==='ArrowDown'||e.key==='s') { nextDir={x:0,y:1}; e.preventDefault(); }
    if(gameOver && e.key==='Enter') newGame();
});
document.getElementById('mu').addEventListener('click',()=>nextDir={x:0,y:-1});
document.getElementById('md').addEventListener('click',()=>nextDir={x:0,y:1});
document.getElementById('ml').addEventListener('click',()=>nextDir={x:-1,y:0});
document.getElementById('mr').addEventListener('click',()=>nextDir={x:1,y:0});

function update() {
    if(gameOver) return;
    tick++;
    pac.anim = Math.abs(Math.sin(tick*0.15))*0.4;

    // Move pac every N frames (tile-based movement with smooth interpolation)
    moveTimer++;
    const moveRate = 4; // move every 4 frames
    if(moveTimer >= moveRate) {
        moveTimer=0;
        // Try next direction first
        if(nextDir.x!==0||nextDir.y!==0) {
            if(isWalkable(pac.x+nextDir.x, pac.y+nextDir.y)) {
                dir = {...nextDir};
            }
        }
        // Move in current direction
        if(dir.x!==0||dir.y!==0) {
            const nx=pac.x+dir.x, ny=pac.y+dir.y;
            if(isWalkable(nx,ny)) {
                pac.x=nx; pac.y=ny;
            }
        }
        // Eat
        if(pac.x>=0&&pac.x<COLS&&pac.y>=0&&pac.y<ROWS) {
            if(map[pac.y][pac.x]===0) { map[pac.y][pac.x]=3; score+=10; dots--; }
            if(map[pac.y][pac.x]===2) { map[pac.y][pac.x]=3; score+=50; dots--; powerTime=200; ghosts.forEach(g=>g.scared=true); }
        }
        document.getElementById('score').textContent=score;

        // Move ghosts
        ghosts.forEach(g => moveGhost(g));

        // Check collision
        ghosts.forEach(g => {
            if(g.x===pac.x && g.y===pac.y) {
                if(g.scared) { g.x=10; g.y=10; g.scared=false; score+=200; document.getElementById('score').textContent=score; }
                else loseLife();
            }
        });
    }

    // Power timer
    if(powerTime>0) { powerTime--; if(powerTime<=0) ghosts.forEach(g=>g.scared=false); }

    // Level complete
    if(dots<=0) { level++; document.getElementById('level').textContent=level; initMap(); resetLevel(); }
}

function moveGhost(g) {
    const dirs=[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
    const valid = dirs.filter(d => isWalkable(g.x+d.x,g.y+d.y) && !(d.x===-g.dx&&d.y===-g.dy));
    if(valid.length===0) { g.dx=-g.dx; g.dy=-g.dy; return; }

    let chosen;
    if(!g.scared && Math.random()>0.4) {
        // Chase: pick direction closest to pac
        valid.sort((a,b) => {
            const da=Math.abs((g.x+a.x)-pac.x)+Math.abs((g.y+a.y)-pac.y);
            const db=Math.abs((g.x+b.x)-pac.x)+Math.abs((g.y+b.y)-pac.y);
            return da-db;
        });
        chosen=valid[0];
    } else {
        chosen=valid[Math.floor(Math.random()*valid.length)];
    }
    g.dx=chosen.x; g.dy=chosen.y;
    g.x+=g.dx; g.y+=g.dy;
}

function loseLife() {
    lives--;
    document.getElementById('lives').textContent='●'.repeat(Math.max(0,lives));
    if(lives<=0) { gameOver=true; showHighScores('pacman',score); }
    else resetLevel();
}

function draw() {
    ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);

    // Maze
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
        const x=c*T, y=r*T, t=map[r][c];
        if(t===1) {
            ctx.fillStyle='#1919a6';
            ctx.fillRect(x+1,y+1,T-2,T-2);
            // Rounded wall look
            ctx.strokeStyle='#3333ff'; ctx.lineWidth=2;
            ctx.strokeRect(x+2,y+2,T-4,T-4);
        }
        if(t===0) {
            ctx.fillStyle='#ffb8ae';
            ctx.beginPath(); ctx.arc(x+T/2,y+T/2,2.5,0,Math.PI*2); ctx.fill();
        }
        if(t===2) {
            ctx.fillStyle='#ffb8ae';
            ctx.beginPath(); ctx.arc(x+T/2,y+T/2,6,0,Math.PI*2); ctx.fill();
        }
    }

    // Pac-Man
    const px=pac.x*T+T/2, py=pac.y*T+T/2;
    const angle = Math.atan2(dir.y, dir.x);
    ctx.fillStyle='#ffff00';
    ctx.beginPath();
    ctx.arc(px, py, T/2-2, angle+pac.anim, angle+Math.PI*2-pac.anim);
    ctx.lineTo(px, py);
    ctx.fill();
    // Eye
    ctx.fillStyle='#000';
    const ex=px+Math.cos(angle-0.5)*4, ey=py+Math.sin(angle-0.5)*4;
    ctx.beginPath(); ctx.arc(ex,ey,1.5,0,Math.PI*2); ctx.fill();

    // Ghosts
    ghosts.forEach(g => {
        const gx=g.x*T+T/2, gy=g.y*T+T/2;
        const scared = g.scared;
        ctx.fillStyle = scared ? (powerTime<40&&tick%8<4?'#fff':'#2222ff') : g.color;
        // Body shape
        ctx.beginPath();
        ctx.arc(gx, gy-2, T/2-2, Math.PI, 0);
        ctx.lineTo(gx+T/2-2, gy+T/2-2);
        for(let i=0;i<3;i++) {
            const bx = gx+T/2-2 - i*(T-4)/2;
            ctx.lineTo(bx, gy+T/2-2-(i%2===0?0:5));
        }
        ctx.lineTo(gx-T/2+2, gy+T/2-2);
        ctx.closePath();
        ctx.fill();
        // Eyes
        if(!scared) {
            ctx.fillStyle='#fff';
            ctx.beginPath(); ctx.arc(gx-3,gy-2,3.5,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(gx+3,gy-2,3.5,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#00f';
            ctx.beginPath(); ctx.arc(gx-3+g.dx*1.5,gy-2+g.dy*1.5,1.5,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(gx+3+g.dx*1.5,gy-2+g.dy*1.5,1.5,0,Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle='#fff';
            ctx.fillRect(gx-4,gy-2,2,2); ctx.fillRect(gx+2,gy-2,2,2);
        }
    });

    // Game over
    if(gameOver) {
        ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#ff0'; ctx.font='bold 18px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('GAME OVER',canvas.width/2, canvas.height/2-5);
        ctx.fillStyle='#fff'; ctx.font='13px Nunito';
        ctx.fillText('Press Enter to retry',canvas.width/2, canvas.height/2+25);
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
newGame(); loop();
