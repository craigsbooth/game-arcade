// ===== PAC-MAN =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const T = 20; // tile size
// Classic 28x31 maze layout: 0=path,1=wall,2=dot,3=power,4=empty
const MAP_STR = [
    '1111111111111111111111111111',
    '1222222222222112222222222221',
    '1211112111112112111121111121',
    '1311112111112112111121111131',
    '1211112111112112111121111121',
    '1222222222222222222222222221',
    '1211112112111111211211112121',
    '1211112112111111211211112121',
    '1222222112222112222112222221',
    '1111112111110110111121111121',
    '0000012111110110111121000000',
    '1111112110000000011211111111',
    '1111112110111011011211111111',
    '0000002000100010002000000000',
    '1111112110111111011211111111',
    '1111112110000000011211111111',
    '0000012110111111011210000000',
    '1111112110111111011211111111',
    '1222222222222112222222222221',
    '1211112111112112111121111121',
    '1211112111112112111121111121',
    '1322112222222002222222112231',
    '1112112112111111211211211121',
    '1112112112111111211211211121',
    '1222222212222112222122222221',
    '1211111111112112111111111121',
    '1211111111112112111111111121',
    '1222222222222222222222222221',
    '1111111111111111111111111111',
];

const COLS = 28, ROWS = MAP_STR.length;
canvas.width = COLS*T; canvas.height = ROWS*T;
let map, pacman, ghosts, score, lives, level, gameOver, dots, powerTimer, mouthOpen;
let dir={x:0,y:0}, nextDir={x:0,y:0}, tick=0;
const GHOST_COLORS = ['#ff0000','#ffb8ff','#00ffff','#ffb852'];

function initMap() {
    map = MAP_STR.map(row => row.split('').map(Number));
    dots = 0;
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(map[r][c]===2||map[r][c]===3) dots++;
}

function newGame() {
    score=0; lives=3; level=1; gameOver=false;
    document.getElementById('score').textContent='0';
    document.getElementById('lives').textContent='●●●';
    document.getElementById('level').textContent='1';
    initMap(); resetPositions();
}

function resetPositions() {
    pacman = {x:14,y:23,dx:0,dy:0};
    dir={x:0,y:0}; nextDir={x:0,y:0}; mouthOpen=0;
    ghosts = [
        {x:14,y:11,dx:1,dy:0,color:GHOST_COLORS[0],scared:false,mode:'scatter'},
        {x:12,y:13,dx:0,dy:-1,color:GHOST_COLORS[1],scared:false,mode:'scatter'},
        {x:14,y:13,dx:0,dy:-1,color:GHOST_COLORS[2],scared:false,mode:'scatter'},
        {x:16,y:13,dx:0,dy:-1,color:GHOST_COLORS[3],scared:false,mode:'scatter'},
    ];
    powerTimer=0;
}

function canMove(x,y) {
    const c=Math.floor(x), r=Math.floor(y);
    if(c<0||c>=COLS||r<0||r>=ROWS) return true; // tunnel
    return map[r][c]!==1;
}

// Input
document.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'||e.key==='a') nextDir={x:-1,y:0};
    if(e.key==='ArrowRight'||e.key==='d') nextDir={x:1,y:0};
    if(e.key==='ArrowUp'||e.key==='w') nextDir={x:0,y:-1};
    if(e.key==='ArrowDown'||e.key==='s') nextDir={x:0,y:1};
    if(gameOver&&e.key==='Enter') newGame();
});
document.getElementById('mu').addEventListener('click',()=>nextDir={x:0,y:-1});
document.getElementById('md').addEventListener('click',()=>nextDir={x:0,y:1});
document.getElementById('ml').addEventListener('click',()=>nextDir={x:-1,y:0});
document.getElementById('mr').addEventListener('click',()=>nextDir={x:1,y:0});

function update() {
    if(gameOver) return;
    tick++;
    mouthOpen = Math.sin(tick*0.3)*0.3+0.3;

    // Try next direction
    const nx=pacman.x+nextDir.x, ny=pacman.y+nextDir.y;
    if(canMove(nx,ny)) { dir=nextDir; }
    // Move pacman
    const mx=pacman.x+dir.x*0.12, my=pacman.y+dir.y*0.12;
    if(canMove(Math.floor(mx+0.5), Math.floor(my+0.5))) {
        pacman.x=mx; pacman.y=my;
    }
    // Tunnel wrap
    if(pacman.x<-0.5) pacman.x=COLS-0.5;
    if(pacman.x>COLS-0.5) pacman.x=-0.5;

    // Eat dots
    const pr=Math.floor(pacman.y+0.5), pc=Math.floor(pacman.x+0.5);
    if(pr>=0&&pr<ROWS&&pc>=0&&pc<COLS) {
        if(map[pr][pc]===2) { map[pr][pc]=4; score+=10; dots--; }
        if(map[pr][pc]===3) { map[pr][pc]=4; score+=50; dots--; powerTimer=300; ghosts.forEach(g=>g.scared=true); }
    }
    document.getElementById('score').textContent=score;

    // Power timer
    if(powerTimer>0) { powerTimer--; if(powerTimer===0) ghosts.forEach(g=>g.scared=false); }

    // Move ghosts
    const spd = 0.08 + level*0.005;
    ghosts.forEach(g => {
        // Simple AI: random direction at intersections, chase when not scared
        if(tick%8===0) {
            const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
            const valid = dirs.filter(d => {
                const gx=Math.floor(g.x+d.x+0.5), gy=Math.floor(g.y+d.y+0.5);
                return canMove(gx,gy) && !(d.x===-g.dx&&d.y===-g.dy);
            });
            if(valid.length>0) {
                if(!g.scared && Math.random()>0.3) {
                    // Chase pacman
                    valid.sort((a,b)=>{
                        const da=Math.abs(pacman.x-(g.x+a.x))+Math.abs(pacman.y-(g.y+a.y));
                        const db=Math.abs(pacman.x-(g.x+b.x))+Math.abs(pacman.y-(g.y+b.y));
                        return da-db;
                    });
                    g.dx=valid[0].x; g.dy=valid[0].y;
                } else {
                    const pick=valid[Math.floor(Math.random()*valid.length)];
                    g.dx=pick.x; g.dy=pick.y;
                }
            }
        }
        const gmx=g.x+g.dx*spd*(g.scared?0.5:1), gmy=g.y+g.dy*spd*(g.scared?0.5:1);
        if(canMove(Math.floor(gmx+0.5),Math.floor(gmy+0.5))) { g.x=gmx; g.y=gmy; }
        if(g.x<-0.5) g.x=COLS-0.5; if(g.x>COLS-0.5) g.x=-0.5;

        // Collision with pacman
        if(Math.abs(g.x-pacman.x)<0.7 && Math.abs(g.y-pacman.y)<0.7) {
            if(g.scared) { g.x=14; g.y=13; g.scared=false; score+=200; }
            else { loseLife(); }
        }
    });

    // Level clear
    if(dots<=0) { level++; document.getElementById('level').textContent=level; initMap(); resetPositions(); }
}

function loseLife() {
    lives--;
    document.getElementById('lives').textContent='●'.repeat(Math.max(0,lives));
    if(lives<=0) { gameOver=true; showHighScores('pacman',score); }
    else resetPositions();
}

function draw() {
    ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);

    // Map
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
        const t=map[r][c], x=c*T, y=r*T;
        if(t===1) {
            ctx.fillStyle='#1a1aff';
            ctx.fillRect(x+1,y+1,T-2,T-2);
            ctx.strokeStyle='#4444ff'; ctx.lineWidth=1;
            ctx.strokeRect(x+2,y+2,T-4,T-4);
        }
        if(t===2) { ctx.fillStyle='#ffb8ae'; ctx.beginPath(); ctx.arc(x+T/2,y+T/2,2.5,0,Math.PI*2); ctx.fill(); }
        if(t===3) { ctx.fillStyle='#ffb8ae'; ctx.beginPath(); ctx.arc(x+T/2,y+T/2,6,0,Math.PI*2); ctx.fill(); }
    }

    // Pacman
    const px=pacman.x*T+T/2, py=pacman.y*T+T/2;
    const angle = Math.atan2(dir.y,dir.x);
    ctx.fillStyle='#ffff00';
    ctx.beginPath();
    ctx.arc(px,py,T/2-2, angle+mouthOpen, angle+Math.PI*2-mouthOpen);
    ctx.lineTo(px,py);
    ctx.fill();

    // Ghosts
    ghosts.forEach(g => {
        const gx=g.x*T+T/2, gy=g.y*T+T/2;
        ctx.fillStyle = g.scared ? (powerTimer<60&&tick%10<5?'#fff':'#0000ff') : g.color;
        // Body
        ctx.beginPath();
        ctx.arc(gx,gy-2,T/2-2,Math.PI,0);
        ctx.lineTo(gx+T/2-2,gy+T/2-2);
        // Wavy bottom
        for(let i=0;i<4;i++){
            const wx=gx+T/2-2-i*(T-4)/3;
            ctx.lineTo(wx, gy+T/2-2-(i%2===0?4:0));
        }
        ctx.closePath(); ctx.fill();
        // Eyes
        if(!g.scared) {
            ctx.fillStyle='#fff';
            ctx.beginPath(); ctx.arc(gx-3,gy-3,3,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(gx+3,gy-3,3,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='#00f';
            ctx.beginPath(); ctx.arc(gx-3+g.dx,gy-3+g.dy,1.5,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(gx+3+g.dx,gy-3+g.dy,1.5,0,Math.PI*2); ctx.fill();
        }
    });

    // Game over text
    if(gameOver) {
        ctx.fillStyle='#ff0'; ctx.font='bold 20px "Press Start 2P"'; ctx.textAlign='center';
        ctx.fillText('GAME OVER',canvas.width/2, canvas.height/2);
        ctx.font='12px Nunito';
        ctx.fillText('Press Enter to retry',canvas.width/2, canvas.height/2+30);
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
newGame(); loop();
