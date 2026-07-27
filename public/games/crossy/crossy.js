// ===== CROSSY ROAD =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 440, H = 600;
canvas.width = W; canvas.height = H;
const TILE = 40;
const COLS = Math.floor(W/TILE);

let player, rows, score, best, gameState, cameraY, highestRow;
best = parseInt(localStorage.getItem('crossy-best')||'0');

// Row types: grass, road, water, rail
function genRow(index) {
    const types = ['grass','road','road','road','grass','water','road','grass'];
    const type = index===0?'grass':types[Math.abs(index)%types.length+(index*7%3)];
    const row = { y:index, type, objects:[] };
    if(type==='road') {
        const speed = (0.8+Math.random()*1.5)*(Math.random()>0.5?1:-1);
        const gap = 100+Math.random()*80;
        for(let i=0;i<4;i++) row.objects.push({x:i*gap+Math.random()*40,w:40+Math.random()*30,speed,color:['#e74c3c','#3498db','#f39c12','#9b59b6','#1abc9c'][Math.floor(Math.random()*5)]});
    }
    if(type==='water') {
        const speed = (0.5+Math.random()*1)*(Math.random()>0.5?1:-1);
        const gap = 80+Math.random()*50;
        for(let i=0;i<4;i++) row.objects.push({x:i*gap,w:50+Math.random()*40,speed,color:'#8B4513'});
    }
    return row;
}

function newGame() {
    player={x:Math.floor(COLS/2),y:0,targetX:Math.floor(COLS/2),targetY:0,anim:0};
    rows={}; score=0; highestRow=0; cameraY=0; gameState='ready';
    for(let i=-5;i<20;i++) rows[i]=genRow(i);
    document.getElementById('score-display').textContent='0';
    document.getElementById('msg').textContent='Tap or ↑ to hop forward';
    document.getElementById('msg').style.display='block';
}

function move(dx,dy) {
    if(gameState==='dead') { newGame(); return; }
    if(gameState==='ready') { gameState='playing'; document.getElementById('msg').style.display='none'; }
    const nx=player.x+dx, ny=player.y+dy;
    if(nx<0||nx>=COLS) return;
    player.x=nx; player.y=ny; player.anim=1;
    if(ny>highestRow) { highestRow=ny; score=highestRow; document.getElementById('score-display').textContent=score; }
    // Generate new rows ahead
    for(let i=player.y;i<player.y+15;i++) { if(!rows[i]) rows[i]=genRow(i); }
}

// Input
document.addEventListener('keydown',e=>{
    if(e.key==='ArrowUp'||e.key==='w') move(0,1);
    if(e.key==='ArrowDown'||e.key==='s') move(0,-1);
    if(e.key==='ArrowLeft'||e.key==='a') move(-1,0);
    if(e.key==='ArrowRight'||e.key==='d') move(1,0);
});
canvas.addEventListener('click', ()=>move(0,1));
canvas.addEventListener('touchstart', e=>{e.preventDefault();move(0,1);});

function update() {
    if(gameState!=='playing') return;
    // Smooth camera
    cameraY += (player.y*TILE - H*0.6 - cameraY)*0.1;
    player.anim *= 0.85;

    // Move objects
    Object.values(rows).forEach(row=>{
        row.objects.forEach(o=>{
            o.x+=o.speed;
            if(o.speed>0 && o.x>W+50) o.x=-o.w-20;
            if(o.speed<0 && o.x+o.w<-50) o.x=W+20;
        });
    });

    // Check collision
    const row = rows[player.y];
    if(row) {
        const px = player.x*TILE+TILE/2;
        if(row.type==='road') {
            for(const o of row.objects) {
                if(px>o.x && px<o.x+o.w) { die(); return; }
            }
        }
        if(row.type==='water') {
            let onLog=false;
            for(const o of row.objects) {
                if(px>o.x && px<o.x+o.w) { onLog=true; player.x+=(o.speed/TILE)*0.3; break; }
            }
            if(!onLog) { die(); return; }
        }
    }
    // Off screen behind
    if(player.y < highestRow-8) die();
}

function die() {
    gameState='dead';
    if(score>best){best=score;localStorage.setItem('crossy-best',String(best));}
    document.getElementById('msg').textContent=`Score: ${score} | Best: ${best}\nTap to retry`;
    document.getElementById('msg').style.display='block';
    showHighScores('crossy',score);
}

function draw() {
    ctx.fillStyle='#4a7c2e'; ctx.fillRect(0,0,W,H);

    // Draw visible rows
    const startRow = Math.floor(cameraY/TILE)-2;
    const endRow = startRow + Math.ceil(H/TILE)+4;
    for(let i=startRow;i<endRow;i++) {
        const row = rows[i];
        if(!row) continue;
        const sy = H - (i*TILE - cameraY);

        // Row background
        if(row.type==='grass') {
            ctx.fillStyle = i%2===0?'#4a7c2e':'#3d6b25';
            ctx.fillRect(0,sy,W,TILE);
            // Grass detail
            ctx.fillStyle='rgba(0,0,0,0.05)';
            for(let x=0;x<W;x+=12) ctx.fillRect(x+(i*7%6),sy+TILE-4,2,4);
        } else if(row.type==='road') {
            ctx.fillStyle='#444';
            ctx.fillRect(0,sy,W,TILE);
            ctx.fillStyle='#555';
            ctx.fillRect(0,sy,W,2);
            ctx.fillRect(0,sy+TILE-2,W,2);
            // Road markings
            ctx.fillStyle='rgba(255,255,255,0.15)';
            for(let x=0;x<W;x+=30) ctx.fillRect(x,sy+TILE/2-1,15,2);
        } else if(row.type==='water') {
            ctx.fillStyle='#2980b9';
            ctx.fillRect(0,sy,W,TILE);
            ctx.fillStyle='rgba(255,255,255,0.05)';
            for(let x=0;x<W;x+=20) ctx.fillRect(x+(Date.now()*0.01+i*10)%W,sy+TILE/2,10,2);
        }

        // Objects
        row.objects.forEach(o=>{
            if(row.type==='road') {
                // Car
                ctx.fillStyle=o.color;
                ctx.fillRect(o.x,sy+4,o.w,TILE-8);
                ctx.fillStyle='rgba(255,255,255,0.3)';
                ctx.fillRect(o.x+(o.speed>0?o.w-12:4),sy+8,10,TILE-16);
                ctx.fillStyle='rgba(0,0,0,0.2)';
                ctx.fillRect(o.x,sy+TILE-8,o.w,4);
            }
            if(row.type==='water') {
                // Log
                ctx.fillStyle=o.color;
                ctx.fillRect(o.x,sy+6,o.w,TILE-12);
                ctx.fillStyle='rgba(0,0,0,0.15)';
                ctx.fillRect(o.x+4,sy+10,o.w-8,2);
                ctx.fillRect(o.x+4,sy+TILE-14,o.w-8,2);
                ctx.strokeStyle='rgba(0,0,0,0.1)';ctx.lineWidth=1;
                ctx.strokeRect(o.x,sy+6,o.w,TILE-12);
            }
        });
    }

    // Player (chicken-like)
    const px = player.x*TILE, py = H-(player.y*TILE-cameraY);
    const bounce = player.anim*-6;
    ctx.fillStyle='#fff';
    ctx.fillRect(px+8,py+6+bounce,TILE-16,TILE-10);
    ctx.fillStyle='#f97316';
    ctx.fillRect(px+12,py+TILE-6+bounce,6,4); // beak
    ctx.fillStyle='#000';
    ctx.fillRect(px+14,py+10+bounce,3,3); // eye
    ctx.fillRect(px+10,py+TILE-4+bounce,4,4); // foot
    ctx.fillRect(px+20,py+TILE-4+bounce,4,4); // foot
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
newGame(); loop();
