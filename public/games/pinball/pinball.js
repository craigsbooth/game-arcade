// ===== PINBALL with Matter.js Physics =====
const { Engine, Render, Runner, Bodies, Body, Composite, Constraint,
        Events, Vector, World } = Matter;

const canvas = document.getElementById('canvas');
const W = 400, H = 720;
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');

// ===== STATE =====
let score = 0, balls = 3, multiplier = 1, combo = 0;
let best = parseInt(localStorage.getItem('pinball-best') || '0');
let gameOver = false, ballLaunched = false, launching = false, launchPower = 0;
let engine, ball, leftFlipper, rightFlipper, leftFlipperConstraint, rightFlipperConstraint;
let bumperBodies = [], targetBodies = [];
let particles = [], floatingTexts = [];

// DOM
const elScore = document.getElementById('score');
const elBalls = document.getElementById('balls');
const elBest = document.getElementById('best');
const elMulti = document.getElementById('multi');
const overlay = document.getElementById('overlay');
document.getElementById('play-again').addEventListener('click', newGame);
elBest.textContent = best.toLocaleString();

// ===== ENGINE SETUP =====
function createEngine() {
    engine = Engine.create({ gravity: { x: 0, y: 1.2 } });

    // Walls
    const wallOpts = { isStatic: true, restitution: 0.4, friction: 0.1, render: { visible: false } };
    const leftWall = Bodies.rectangle(8, H/2, 16, H, wallOpts);
    const rightWall = Bodies.rectangle(W-8, H/2 - 80, 16, H-160, wallOpts);
    const topWall = Bodies.rectangle(W/2, 8, W, 16, wallOpts);
    const launchWall = Bodies.rectangle(W-8, H/2, 16, H, wallOpts);
    // Launch lane divider
    const laneDivider = Bodies.rectangle(W-45, H/2 - 50, 6, H - 200, wallOpts);

    // Angled gutters at bottom
    const leftGutter = Bodies.rectangle(40, H-30, 80, 8, { ...wallOpts, angle: 0.5 });
    const rightGutter = Bodies.rectangle(W-70, H-30, 80, 8, { ...wallOpts, angle: -0.5 });

    Composite.add(engine.world, [leftWall, rightWall, topWall, launchWall, laneDivider, leftGutter, rightGutter]);

    // Flippers
    createFlippers();

    // Bumpers
    createBumpers();

    // Targets
    createTargets();

    // Drain sensor
    const drain = Bodies.rectangle(W/2, H + 30, W, 20, { isStatic: true, isSensor: true, label: 'drain' });
    Composite.add(engine.world, [drain]);

    // Ball
    createBall();

    // Collision events
    Events.on(engine, 'collisionStart', handleCollision);
}

function createBall() {
    ball = Bodies.circle(W - 25, H - 100, 9, {
        restitution: 0.6, friction: 0.01, density: 0.002,
        label: 'ball', frictionAir: 0.01
    });
    Composite.add(engine.world, [ball]);
    ballLaunched = false;
}

function createFlippers() {
    const flipOpts = { density: 0.01, friction: 0.1, restitution: 0.1 };
    const pivotOpts = { isStatic: true };

    // Left flipper
    leftFlipper = Bodies.rectangle(120, H - 60, 70, 12, { ...flipOpts, label: 'flipper', chamfer: { radius: 6 } });
    const leftPivot = Bodies.circle(90, H - 60, 5, pivotOpts);
    leftFlipperConstraint = Constraint.create({
        bodyA: leftFlipper, pointA: { x: -30, y: 0 },
        bodyB: leftPivot, pointB: { x: 0, y: 0 },
        stiffness: 0.9, length: 0
    });

    // Right flipper
    rightFlipper = Bodies.rectangle(W - 150, H - 60, 70, 12, { ...flipOpts, label: 'flipper', chamfer: { radius: 6 } });
    const rightPivot = Bodies.circle(W - 120, H - 60, 5, pivotOpts);
    rightFlipperConstraint = Constraint.create({
        bodyA: rightFlipper, pointA: { x: 30, y: 0 },
        bodyB: rightPivot, pointB: { x: 0, y: 0 },
        stiffness: 0.9, length: 0
    });

    Composite.add(engine.world, [leftFlipper, leftPivot, leftFlipperConstraint, rightFlipper, rightPivot, rightFlipperConstraint]);
}

function createBumpers() {
    const bumperData = [
        { x: 130, y: 180, r: 24 },
        { x: W - 160, y: 180, r: 24 },
        { x: W/2 - 20, y: 150, r: 28 },
        { x: 90, y: 300, r: 20 },
        { x: W - 130, y: 300, r: 20 },
        { x: W/2, y: 260, r: 22 },
        { x: W/2 - 50, y: 380, r: 18 },
        { x: W/2 + 40, y: 380, r: 18 },
    ];
    bumperData.forEach(b => {
        const body = Bodies.circle(b.x, b.y, b.r, {
            isStatic: true, restitution: 1.5, label: 'bumper',
            plugin: { score: 100, hit: 0 }
        });
        bumperBodies.push(body);
        Composite.add(engine.world, [body]);
    });
}

function createTargets() {
    const targetData = [
        { x: 60, y: 420 }, { x: 60, y: 450 }, { x: 60, y: 480 },
        { x: W - 90, y: 420 }, { x: W - 90, y: 450 }, { x: W - 90, y: 480 },
    ];
    targetData.forEach(t => {
        const body = Bodies.rectangle(t.x, t.y, 10, 22, {
            isStatic: true, restitution: 0.8, label: 'target',
            plugin: { active: true, score: 200 }
        });
        targetBodies.push(body);
        Composite.add(engine.world, [body]);
    });
}

function handleCollision(event) {
    event.pairs.forEach(pair => {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        const bodies = [pair.bodyA, pair.bodyB];

        // Ball hits drain
        if (labels.includes('ball') && labels.includes('drain')) {
            handleDrain();
            return;
        }

        // Ball hits bumper
        if (labels.includes('ball') && labels.includes('bumper')) {
            const bumper = bodies.find(b => b.label === 'bumper');
            bumper.plugin.hit = 1;
            combo++;
            if (combo % 8 === 0) multiplier = Math.min(5, multiplier + 1);
            addPoints(bumper.plugin.score, bumper.position.x, bumper.position.y - 20);
            spawnParticles(bumper.position.x, bumper.position.y, '#a78bfa', 5);
            // Extra kick
            const dir = Vector.normalise(Vector.sub(ball.position, bumper.position));
            Body.setVelocity(ball, Vector.add(ball.velocity, Vector.mult(dir, 4)));
        }

        // Ball hits target
        if (labels.includes('ball') && labels.includes('target')) {
            const target = bodies.find(b => b.label === 'target');
            if (target.plugin.active) {
                target.plugin.active = false;
                addPoints(target.plugin.score, target.position.x, target.position.y - 15);
                spawnParticles(target.position.x, target.position.y, '#facc15', 4);
                // Check bank clear
                const leftBank = targetBodies.slice(0, 3);
                const rightBank = targetBodies.slice(3, 6);
                if (leftBank.every(t => !t.plugin.active)) {
                    addPoints(2000, 100, 450); floatText('+2000 BANK!', W/2, H/2);
                    leftBank.forEach(t => t.plugin.active = true);
                }
                if (rightBank.every(t => !t.plugin.active)) {
                    addPoints(2000, W-100, 450); floatText('+2000 BANK!', W/2, H/2);
                    rightBank.forEach(t => t.plugin.active = true);
                }
            }
        }
    });
}

function handleDrain() {
    balls--;
    combo = 0;
    multiplier = Math.max(1, multiplier - 1);
    elBalls.textContent = balls;
    elMulti.textContent = '×' + multiplier;
    Composite.remove(engine.world, ball);
    if (balls <= 0) {
        gameOver = true;
        if (score > best) { best = score; localStorage.setItem('pinball-best', String(best)); elBest.textContent = best.toLocaleString(); }
        document.getElementById('overlay-score').textContent = 'Score: ' + score.toLocaleString();
        overlay.classList.remove('hidden');
    } else {
        setTimeout(createBall, 800);
    }
}

function addPoints(pts, x, y) {
    const total = pts * multiplier;
    score += total;
    elScore.textContent = score.toLocaleString();
    elMulti.textContent = '×' + multiplier;
    if (x !== undefined) floatText('+' + total, x, y);
}

function floatText(text, x, y) {
    floatingTexts.push({ text, x, y, life: 1.5 });
}

function spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) particles.push({
        x, y, vx: (Math.random()-0.5)*8, vy: (Math.random()-0.5)*6-3,
        life: 1, color
    });
}

// ===== INPUT =====
let leftDown = false, rightDown = false;
document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'z') leftDown = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === '/') rightDown = true;
    if (e.key === ' ') { e.preventDefault(); launching = true; }
});
document.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'z') leftDown = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === '/') rightDown = false;
    if (e.key === ' ') { launchBall(); launching = false; launchPower = 0; }
});
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
        const x = (t.clientX - rect.left) / (rect.width / W);
        if (x < W * 0.3) leftDown = true;
        else if (x > W * 0.7) rightDown = true;
        else launching = true;
    }
});
canvas.addEventListener('touchend', e => {
    e.preventDefault();
    leftDown = false; rightDown = false;
    if (launching) { launchBall(); launching = false; launchPower = 0; }
});

function launchBall() {
    if (ballLaunched || gameOver) return;
    ballLaunched = true;
    const power = 12 + (launchPower / 100) * 15;
    Body.setVelocity(ball, { x: -0.5, y: -power });
}

function newGame() {
    // Clean up old world
    if (engine) { Engine.clear(engine); Composite.clear(engine.world, false); }
    bumperBodies = []; targetBodies = [];
    score = 0; balls = 3; multiplier = 1; combo = 0; gameOver = false;
    particles = []; floatingTexts = [];
    elScore.textContent = '0'; elBalls.textContent = '3'; elMulti.textContent = '×1';
    overlay.classList.add('hidden');
    createEngine();
}

// ===== GAME LOOP =====
function update() {
    if (gameOver) return;

    // Launch power
    if (launching && !ballLaunched) {
        launchPower = Math.min(launchPower + 3, 100);
    }

    // Flipper control via angular velocity
    if (leftDown) {
        Body.setAngularVelocity(leftFlipper, -0.3);
    } else {
        Body.setAngularVelocity(leftFlipper, 0.15);
    }
    // Clamp left flipper angle
    if (leftFlipper.angle < -0.6) Body.setAngle(leftFlipper, -0.6);
    if (leftFlipper.angle > 0.4) Body.setAngle(leftFlipper, 0.4);

    if (rightDown) {
        Body.setAngularVelocity(rightFlipper, 0.3);
    } else {
        Body.setAngularVelocity(rightFlipper, -0.15);
    }
    if (rightFlipper.angle > 0.6) Body.setAngle(rightFlipper, 0.6);
    if (rightFlipper.angle < -0.4) Body.setAngle(rightFlipper, -0.4);

    // Decay bumper hit glow
    bumperBodies.forEach(b => { b.plugin.hit = Math.max(0, b.plugin.hit - 0.03); });

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.03; });
    floatingTexts = floatingTexts.filter(t => t.life > 0);
    floatingTexts.forEach(t => { t.y -= 0.8; t.life -= 0.025; });

    Engine.update(engine, 1000/60);
}

function render() {
    ctx.fillStyle = '#0c0824';
    ctx.fillRect(0, 0, W, H);

    // Table surface
    ctx.fillStyle = '#100a2e';
    ctx.fillRect(16, 16, W - 60, H - 16);

    // Launch lane
    ctx.fillStyle = 'rgba(167,139,250,0.03)';
    ctx.fillRect(W - 44, 16, 30, H - 16);
    ctx.strokeStyle = 'rgba(167,139,250,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(W - 44, 16, 30, H - 16);

    // Bumpers
    bumperBodies.forEach(b => {
        const glow = b.plugin.hit;
        const { x, y } = b.position;
        const r = b.circleRadius;
        // Glow
        if (glow > 0) {
            const g = ctx.createRadialGradient(x, y, r, x, y, r + 15);
            g.addColorStop(0, `rgba(232,121,249,${glow * 0.5})`);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(x, y, r + 15, 0, Math.PI*2); ctx.fill();
        }
        // Body
        const grad = ctx.createRadialGradient(x-3, y-3, 0, x, y, r);
        grad.addColorStop(0, glow > 0.3 ? '#e879f9' : '#6d28d9');
        grad.addColorStop(1, glow > 0.3 ? '#a855f7' : '#3b0764');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = glow > 0.3 ? '#f0abfc' : '#7c3aed';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
        // Ring
        ctx.strokeStyle = `rgba(255,255,255,${0.1 + glow*0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, r - 4, 0, Math.PI*2); ctx.stroke();
    });

    // Targets
    targetBodies.forEach(t => {
        const { x, y } = t.position;
        if (t.plugin.active) {
            ctx.fillStyle = '#facc15';
            ctx.shadowColor = '#facc15'; ctx.shadowBlur = 6;
            ctx.fillRect(x - 5, y - 11, 10, 22);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#ca8a04'; ctx.lineWidth = 1;
            ctx.strokeRect(x - 5, y - 11, 10, 22);
        } else {
            ctx.fillStyle = 'rgba(100,100,100,0.3)';
            ctx.fillRect(x - 5, y - 11, 10, 22);
        }
    });

    // Flippers
    drawBody(leftFlipper, '#d4d0ff', '#a78bfa');
    drawBody(rightFlipper, '#d4d0ff', '#a78bfa');
    // Pivot dots
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath(); ctx.arc(90, H-60, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(W-120, H-60, 5, 0, Math.PI*2); ctx.fill();

    // Ball
    if (ball && Composite.get(engine.world, ball.id, 'body')) {
        const { x, y } = ball.position;
        ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 15;
        const bGrad = ctx.createRadialGradient(x-2, y-2, 0, x, y, 9);
        bGrad.addColorStop(0, '#ffffff');
        bGrad.addColorStop(0.6, '#e0d4ff');
        bGrad.addColorStop(1, '#a78bfa');
        ctx.fillStyle = bGrad;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.arc(x-3, y-3, 3, 0, Math.PI*2); ctx.fill();
    }

    // Launch power bar
    if (launching && !ballLaunched) {
        const barH = launchPower * 0.6;
        ctx.fillStyle = 'rgba(167,139,250,0.3)';
        ctx.fillRect(W-38, H-30-60, 12, 60);
        const grad = ctx.createLinearGradient(0, H-30-barH, 0, H-30);
        grad.addColorStop(0, '#e879f9'); grad.addColorStop(1, '#7c3aed');
        ctx.fillStyle = grad;
        ctx.fillRect(W-38, H-30-barH, 12, barH);
    }

    // Particles
    particles.forEach(p => {
        const r = Math.max(0, 3 * p.life);
        if (r <= 0) return;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Floating texts
    floatingTexts.forEach(t => {
        ctx.globalAlpha = Math.min(1, t.life * 2);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px "Fredoka One"';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1;
}

function drawBody(body, fill, stroke) {
    const verts = body.vertices;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
}

// ===== MAIN LOOP =====
function loop() {
    update();
    render();
    requestAnimationFrame(loop);
}

newGame();
loop();
