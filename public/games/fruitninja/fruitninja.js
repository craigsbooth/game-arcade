// ===== FRUIT NINJA =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 560, H = 500;
canvas.width = W; canvas.height = H;

const FRUITS = [
    { emoji:'🍎', color:'#dc2626', splash:'#ff6b6b', name:'apple' },
    { emoji:'🍊', color:'#ea580c', splash:'#fb923c', name:'orange' },
    { emoji:'🍋', color:'#ca8a04', splash:'#fde047', name:'lemon' },
    { emoji:'🍉', color:'#16a34a', splash:'#4ade80', name:'watermelon' },
    { emoji:'🍇', color:'#7c3aed', splash:'#a78bfa', name:'grape' },
    { emoji:'🍓', color:'#e11d48', splash:'#fb7185', name:'strawberry' },
    { emoji:'🥝', color:'#65a30d', splash:'#84cc16', name:'kiwi' },
    { emoji:'🍑', color:'#f97316', splash:'#fdba74', name:'peach' },
];

let fruits, sliceTrail, particles, halves, score, lives, best, gameState, spawnTimer, combo;
best = parseInt(localStorage.getItem('fruitninja-best')||'0');
document.getElementById('best').textContent = best;

let mouseDown=false, mouseX=0, mouseY=0, prevMX=0, prevMY=0;

// Input
canvas.addEventListener('mousedown', e=>{mouseDown=true;updateMouse(e);});
canvas.addEventListener('mousemove', e=>{updateMouse(e);});
canvas.addEventListener('mouseup', ()=>{mouseDown=false;});
canvas.addEventListener('touchstart', e=>{e.preventDefault();mouseDown=true;updateTouch(e);});
canvas.addEventListener('touchmove', e=>{e.preventDefault();updateTouch(e);});
canvas.addEventListener('touchend', e=>{e.preventDefault();mouseDown=false;});
document.getElementById('retry-btn').addEventListener('click', newGame);

function updateMouse(e){
    const r=canvas.getBoundingClientRect();
    prevMX=mouseX;prevMY=mouseY;
    mouseX=(e.clientX-r.left)*(W/r.width);
    mouseY=(e.clientY-r.top)*(H/r.height);
}
function updateTouch(e){
    const r=canvas.getBoundingClientRect();
    prevMX=mouseX;prevMY=mouseY;
    mouseX=(e.touches[0].clientX-r.left)*(W/r.width);
    mouseY=(e.touches[0].clientY-r.top)*(H/r.height);
}

function newGame() {
    fruits=[]; sliceTrail=[]; particles=[]; halves=[];
    score=0; lives=3; combo=0; spawnTimer=0; gameState='playing';
    document.getElementById('score').textContent='0';
    document.getElementById('lives').textContent='❌❌❌';
    document.getElementById('overlay').classList.add('hidden');
}

function spawnFruit() {
    const isBomb = Math.random()<0.15;
    const f = FRUITS[Math.floor(Math.random()*FRUITS.length)];
    const x = 60+Math.random()*(W-120);
    const vx = (Math.random()-0.5)*4;
    const vy = -(10+Math.random()*4);
    fruits.push({
        x, y:H+30, vx, vy, r:28+Math.random()*8,
        rotation:Math.random()*Math.PI*2, rotSpeed:(Math.random()-0.5)*0.1,
        fruit:f, isBomb, sliced:false
    });
}

function sliceFruit(f) {
    f.sliced = true;
    if(f.isBomb) {
        lives=0;
        gameOver();
        // Bomb explosion
        for(let i=0;i<20;i++) particles.push({
            x:f.x,y:f.y,vx:(Math.random()-0.5)*10,vy:(Math.random()-0.5)*10,
            life:1,color:'#333',size:4+Math.random()*4
        });
        return;
    }
    score += 10 + combo*5;
    combo++;
    document.getElementById('score').textContent=score;

    // Splash particles
    const c = f.fruit.splash;
    for(let i=0;i<12;i++) particles.push({
        x:f.x,y:f.y,vx:(Math.random()-0.5)*8,vy:(Math.random()-0.5)*8-2,
        life:1,color:c,size:3+Math.random()*4
    });

    // Halves
    halves.push(
        {x:f.x-10,y:f.y,vx:-2-Math.random()*2,vy:-3,r:f.r*0.7,rot:0,rotS:-0.1,emoji:f.fruit.emoji,color:f.fruit.color},
        {x:f.x+10,y:f.y,vx:2+Math.random()*2,vy:-3,r:f.r*0.7,rot:0,rotS:0.1,emoji:f.fruit.emoji,color:f.fruit.color}
    );
}

function update() {
    if(gameState!=='playing') return;
    spawnTimer++;
    const rate = Math.max(20, 50-Math.floor(score/50)*3);
    if(spawnTimer>=rate) { spawnTimer=0; const count=1+Math.floor(score/100); for(let i=0;i<Math.min(count,4);i++) setTimeout(()=>spawnFruit(),i*150); }

    // Move fruits
    fruits.forEach(f => {
        if(f.sliced) return;
        f.x+=f.vx; f.y+=f.vy; f.vy+=0.3; f.rotation+=f.rotSpeed;
    });

    // Check missed fruits
    fruits.forEach(f => {
        if(!f.sliced && !f.isBomb && f.y>H+50) {
            f.sliced=true; // mark to prevent double-count
            lives--;
            combo=0;
            document.getElementById('lives').textContent='❌'.repeat(Math.max(0,lives));
            if(lives<=0) gameOver();
        }
    });
    fruits = fruits.filter(f => f.y<H+100 || !f.sliced);

    // Slice detection
    if(mouseDown) {
        sliceTrail.push({x:mouseX,y:mouseY,life:1});
        const dx=mouseX-prevMX, dy=mouseY-prevMY;
        const sliceSpeed=Math.sqrt(dx*dx+dy*dy);
        if(sliceSpeed>5) {
            fruits.forEach(f => {
                if(f.sliced) return;
                const dist=Math.sqrt((mouseX-f.x)**2+(mouseY-f.y)**2);
                if(dist<f.r+10) sliceFruit(f);
            });
        }
    }

    // Trail fade
    sliceTrail=sliceTrail.filter(p=>p.life>0);
    sliceTrail.forEach(p=>p.life-=0.08);

    // Particles
    particles=particles.filter(p=>p.life>0);
    particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.15;p.life-=0.025;p.size*=0.98;});

    // Halves
    halves.forEach(h=>{h.x+=h.vx;h.y+=h.vy;h.vy+=0.35;h.rot+=h.rotS;});
    halves=halves.filter(h=>h.y<H+60);

    // Combo reset if no slices recently
    if(!mouseDown) combo=0;
}

function gameOver() {
    gameState='dead';
    if(score>best){best=score;localStorage.setItem('fruitninja-best',String(best));document.getElementById('best').textContent=best;}
    document.getElementById('ov-stats').textContent=`Score: ${score}`;
    document.getElementById('overlay').classList.remove('hidden');
    showHighScores('fruitninja',score);
}

// ===== RENDER =====
function draw() {
    // Background
    const bg = ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#1a0a2e'); bg.addColorStop(1,'#0f0520');
    ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

    // Subtle wood texture lines
    ctx.strokeStyle='rgba(139,69,19,0.04)';
    ctx.lineWidth=1;
    for(let i=0;i<H;i+=12){ctx.beginPath();ctx.moveTo(0,i+Math.sin(i*0.1)*3);ctx.lineTo(W,i+Math.cos(i*0.1)*3);ctx.stroke();}

    // Halves (sliced fruit)
    halves.forEach(h => {
        ctx.save(); ctx.translate(h.x,h.y); ctx.rotate(h.rot);
        ctx.beginPath(); ctx.arc(0,0,h.r,0,Math.PI); ctx.clip();
        ctx.fillStyle=h.color;
        ctx.beginPath(); ctx.arc(0,0,h.r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(0,0,h.r*0.6,0,Math.PI*2); ctx.fill();
        ctx.restore();
    });

    // Fruits
    fruits.forEach(f => {
        if(f.sliced) return;
        ctx.save(); ctx.translate(f.x,f.y); ctx.rotate(f.rotation);
        if(f.isBomb) {
            // Bomb
            ctx.fillStyle='#1a1a1a';
            ctx.beginPath(); ctx.arc(0,0,f.r,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='#444'; ctx.lineWidth=3;
            ctx.beginPath(); ctx.arc(0,0,f.r,0,Math.PI*2); ctx.stroke();
            ctx.fillStyle='#ef4444'; ctx.font=`${f.r}px sans-serif`; ctx.textAlign='center';
            ctx.fillText('💣',0,f.r*0.35);
            // Fuse spark
            ctx.fillStyle=`rgba(255,200,0,${0.5+Math.random()*0.5})`;
            ctx.beginPath(); ctx.arc(0,-f.r+4,4,0,Math.PI*2); ctx.fill();
        } else {
            // Fruit body
            ctx.fillStyle=f.fruit.color;
            ctx.beginPath(); ctx.arc(0,0,f.r,0,Math.PI*2); ctx.fill();
            // Shading
            const grad=ctx.createRadialGradient(-f.r*0.3,-f.r*0.3,0,0,0,f.r);
            grad.addColorStop(0,'rgba(255,255,255,0.25)'); grad.addColorStop(1,'transparent');
            ctx.fillStyle=grad;
            ctx.beginPath(); ctx.arc(0,0,f.r,0,Math.PI*2); ctx.fill();
            // Emoji
            ctx.font=`${f.r*1.2}px sans-serif`; ctx.textAlign='center';
            ctx.fillText(f.fruit.emoji, 0, f.r*0.4);
        }
        ctx.restore();
    });

    // Slice trail
    if(sliceTrail.length>1) {
        ctx.lineCap='round'; ctx.lineJoin='round';
        for(let i=1;i<sliceTrail.length;i++) {
            const p=sliceTrail[i-1], c=sliceTrail[i];
            ctx.strokeStyle=`rgba(255,255,255,${c.life*0.8})`;
            ctx.lineWidth = c.life*6;
            ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(c.x,c.y); ctx.stroke();
        }
        // Glow
        if(sliceTrail.length>0) {
            const last=sliceTrail[sliceTrail.length-1];
            ctx.shadowColor='#fff'; ctx.shadowBlur=10;
            ctx.fillStyle='rgba(255,255,255,0.8)';
            ctx.beginPath(); ctx.arc(last.x,last.y,3,0,Math.PI*2); ctx.fill();
            ctx.shadowBlur=0;
        }
    }

    // Particles
    particles.forEach(p => {
        const r=Math.max(0,p.size*p.life);
        if(r<=0)return;
        ctx.globalAlpha=p.life;
        ctx.fillStyle=p.color;
        ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha=1;

    // Combo display
    if(combo>2) {
        ctx.fillStyle='rgba(251,191,36,0.9)';
        ctx.font='bold 24px "Fredoka One"'; ctx.textAlign='center';
        ctx.fillText(`${combo}× COMBO!`, W/2, H/2);
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
newGame(); loop();
