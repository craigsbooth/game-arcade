// ===== TETRIS - Premium Edition =====
const COLS = 10, ROWS = 20, BLOCK = 30;
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

const COLORS = {
    I: '#00e5ff', O: '#ffca28', T: '#ab47bc',
    S: '#66bb6a', Z: '#ef5350', J: '#42a5f5', L: '#ffa726'
};
const SHAPES = {
    I: [[0,0],[1,0],[2,0],[3,0]],
    O: [[0,0],[1,0],[0,1],[1,1]],
    T: [[0,0],[1,0],[2,0],[1,1]],
    S: [[1,0],[2,0],[0,1],[1,1]],
    Z: [[0,0],[1,0],[1,1],[2,1]],
    J: [[0,0],[0,1],[1,1],[2,1]],
    L: [[2,0],[0,1],[1,1],[2,1]]
};
const TYPES = Object.keys(SHAPES);

// State
let board = [], piece = null, nextQueue = [], holdPiece = null, canHold = true;
let score = 0, level = 1, lines = 0, gameOver = false;
let dropInterval = 1000, lastDrop = 0, lockDelay = 0, lockTimer = null;
let animatingRows = [], animFrame = 0;

// DOM
const elScore = document.getElementById('score');
const elLevel = document.getElementById('level');
const elLines = document.getElementById('lines');
const overlay = document.getElementById('overlay');
document.getElementById('restart-btn').addEventListener('click', newGame);

// Mobile controls
document.getElementById('ctrl-left').addEventListener('click', () => movePiece(-1, 0));
document.getElementById('ctrl-right').addEventListener('click', () => movePiece(1, 0));
document.getElementById('ctrl-down').addEventListener('click', () => softDrop());
document.getElementById('ctrl-rotate').addEventListener('click', () => rotatePiece());
document.getElementById('ctrl-drop').addEventListener('click', () => hardDrop());

// ===== BOARD =====
function createBoard() {
    board = Array.from({length: ROWS}, () => Array(COLS).fill(null));
}

function isValid(cells) {
    return cells.every(([x,y]) => x>=0 && x<COLS && y>=0 && y<ROWS && !board[y][x]);
}

// ===== PIECES =====
function randomBag() {
    const bag = [...TYPES];
    for (let i=bag.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]]; }
    return bag;
}

function spawnPiece() {
    while (nextQueue.length < 4) nextQueue.push(...randomBag());
    const type = nextQueue.shift();
    piece = {
        type, cells: SHAPES[type].map(([x,y])=>[x+3,y]),
        color: COLORS[type]
    };
    canHold = true;
    if (!isValid(piece.cells)) { gameOver=true; showGameOver(); }
}

function getCells(cells, cx, cy) {
    // Rotate around center
    const xs=cells.map(c=>c[0]), ys=cells.map(c=>c[1]);
    const mx=(Math.min(...xs)+Math.max(...xs))/2;
    const my=(Math.min(...ys)+Math.max(...ys))/2;
    return cells.map(([x,y]) => [Math.round(mx+(y-my)), Math.round(my-(x-mx))]);
}

function rotatePiece() {
    if (!piece || piece.type==='O') return;
    const rotated = getCells(piece.cells);
    // Wall kicks
    const kicks = [0,-1,1,-2,2];
    for (const dx of kicks) {
        const shifted = rotated.map(([x,y])=>[x+dx,y]);
        if (isValid(shifted)) { piece.cells=shifted; resetLock(); return; }
    }
}

function movePiece(dx, dy) {
    if (!piece) return false;
    const moved = piece.cells.map(([x,y])=>[x+dx,y+dy]);
    if (isValid(moved)) { piece.cells=moved; if(dx!==0) resetLock(); return true; }
    return false;
}

function softDrop() { if(movePiece(0,1)) { score+=1; elScore.textContent=score; } }

function hardDrop() {
    if (!piece) return;
    let dropped=0;
    while(movePiece(0,1)) dropped++;
    score += dropped*2;
    elScore.textContent=score;
    lockPiece();
}

function holdSwap() {
    if (!canHold || !piece) return;
    canHold = false;
    const type = piece.type;
    if (holdPiece) {
        const prevHold = holdPiece;
        holdPiece = type;
        piece = { type:prevHold, cells:SHAPES[prevHold].map(([x,y])=>[x+3,y]), color:COLORS[prevHold] };
    } else {
        holdPiece = type;
        spawnPiece();
    }
}

function lockPiece() {
    piece.cells.forEach(([x,y]) => { if(y>=0) board[y][x]=piece.color; });
    clearLines();
    spawnPiece();
}

function resetLock() { lockDelay=0; }

function clearLines() {
    const full = [];
    for (let r=ROWS-1;r>=0;r--) {
        if (board[r].every(c=>c!==null)) full.push(r);
    }
    if (full.length===0) return;

    // Scoring
    const pts = [0,100,300,500,800];
    score += (pts[full.length]||800) * level;
    lines += full.length;
    level = Math.floor(lines/10)+1;
    dropInterval = Math.max(50, 1000 - (level-1)*80);
    elScore.textContent=score; elLevel.textContent=level; elLines.textContent=lines;

    // Remove rows
    full.forEach(r => { board.splice(r,1); board.unshift(Array(COLS).fill(null)); });
}

function getGhost() {
    if (!piece) return [];
    let ghost = piece.cells.map(([x,y])=>[x,y]);
    while(true) {
        const next = ghost.map(([x,y])=>[x,y+1]);
        if (!isValid(next)) break;
        ghost = next;
    }
    return ghost;
}

// ===== INPUT =====
document.addEventListener('keydown', e => {
    if (gameOver) return;
    switch(e.key) {
        case 'ArrowLeft': case 'a': e.preventDefault(); movePiece(-1,0); break;
        case 'ArrowRight': case 'd': e.preventDefault(); movePiece(1,0); break;
        case 'ArrowDown': case 's': e.preventDefault(); softDrop(); break;
        case 'ArrowUp': case 'w': e.preventDefault(); rotatePiece(); break;
        case ' ': e.preventDefault(); hardDrop(); break;
        case 'c': case 'C': holdSwap(); break;
    }
});

// ===== RENDERING =====
function drawBlock(c, x, y, size, alpha) {
    const px=x*size, py=y*size;
    // Main fill
    c.fillStyle = alpha ? `rgba(255,255,255,${alpha})` : '#fff';
    c.fillStyle = alpha !== undefined ? `rgba(${hexToRgb(arguments[5]||'#fff')},${alpha})` : (arguments[5]||'#fff');
    c.fillRect(px+1, py+1, size-2, size-2);
    // Highlight
    c.fillStyle = 'rgba(255,255,255,0.2)';
    c.fillRect(px+1, py+1, size-2, 3);
    c.fillRect(px+1, py+1, 3, size-2);
    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(px+1, py+size-4, size-2, 3);
    c.fillRect(px+size-4, py+1, 3, size-2);
}

function hexToRgb(hex) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
}

function drawBoard() {
    ctx.fillStyle='#0f0f23';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Grid
    ctx.strokeStyle='rgba(255,255,255,0.03)';
    ctx.lineWidth=1;
    for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*BLOCK,0);ctx.lineTo(x*BLOCK,ROWS*BLOCK);ctx.stroke();}
    for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*BLOCK);ctx.lineTo(COLS*BLOCK,y*BLOCK);ctx.stroke();}

    // Locked blocks
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
        if(board[r][c]) {
            ctx.fillStyle=board[r][c];
            ctx.fillRect(c*BLOCK+1,r*BLOCK+1,BLOCK-2,BLOCK-2);
            ctx.fillStyle='rgba(255,255,255,0.15)';
            ctx.fillRect(c*BLOCK+1,r*BLOCK+1,BLOCK-2,3);
            ctx.fillRect(c*BLOCK+1,r*BLOCK+1,3,BLOCK-2);
            ctx.fillStyle='rgba(0,0,0,0.15)';
            ctx.fillRect(c*BLOCK+1,r*BLOCK+BLOCK-4,BLOCK-2,3);
        }
    }

    // Ghost piece
    if(piece) {
        const ghost=getGhost();
        ghost.forEach(([x,y])=>{
            ctx.strokeStyle=piece.color;
            ctx.lineWidth=1.5;
            ctx.strokeRect(x*BLOCK+2,y*BLOCK+2,BLOCK-4,BLOCK-4);
        });
    }

    // Current piece
    if(piece) {
        piece.cells.forEach(([x,y])=>{
            if(y<0)return;
            ctx.fillStyle=piece.color;
            ctx.fillRect(x*BLOCK+1,y*BLOCK+1,BLOCK-2,BLOCK-2);
            ctx.fillStyle='rgba(255,255,255,0.2)';
            ctx.fillRect(x*BLOCK+1,y*BLOCK+1,BLOCK-2,3);
            ctx.fillRect(x*BLOCK+1,y*BLOCK+1,3,BLOCK-2);
            ctx.fillStyle='rgba(0,0,0,0.15)';
            ctx.fillRect(x*BLOCK+1,y*BLOCK+BLOCK-4,BLOCK-2,3);
        });
    }
}

function drawPreview(c, type, offsetY) {
    if(!type) return;
    const cells=SHAPES[type];
    const color=COLORS[type];
    const size=20;
    const xs=cells.map(p=>p[0]), ys=cells.map(p=>p[1]);
    const ox=(100-((Math.max(...xs)-Math.min(...xs)+1)*size))/2 - Math.min(...xs)*size;
    const oy=offsetY+((60-((Math.max(...ys)-Math.min(...ys)+1)*size))/2) - Math.min(...ys)*size;
    cells.forEach(([x,y])=>{
        c.fillStyle=color;
        c.fillRect(ox+x*size+1,oy+y*size+1,size-2,size-2);
        c.fillStyle='rgba(255,255,255,0.15)';
        c.fillRect(ox+x*size+1,oy+y*size+1,size-2,2);
    });
}

function drawNext() {
    nextCtx.fillStyle='rgba(0,0,0,0.3)'; nextCtx.fillRect(0,0,100,240);
    for(let i=0;i<3&&i<nextQueue.length;i++) drawPreview(nextCtx, nextQueue[i], i*80);
}

function drawHold() {
    holdCtx.fillStyle='rgba(0,0,0,0.3)'; holdCtx.fillRect(0,0,100,80);
    if(holdPiece) drawPreview(holdCtx, holdPiece, 0);
}

// ===== GAME LOOP =====
function gameLoop(time) {
    if (gameOver) return;

    // Auto drop
    if (time - lastDrop > dropInterval) {
        if (!movePiece(0,1)) {
            lockDelay += dropInterval;
            if (lockDelay >= 500) { lockPiece(); lockDelay=0; }
        } else { lockDelay=0; }
        lastDrop = time;
    }

    drawBoard();
    drawNext();
    drawHold();
    requestAnimationFrame(gameLoop);
}

function showGameOver() {
    document.getElementById('final-score').textContent = `Score: ${score.toLocaleString()} | Level ${level}`;
    overlay.classList.remove('hidden');
}

function newGame() {
    createBoard();
    nextQueue = [...randomBag(), ...randomBag()];
    holdPiece = null;
    score=0; level=1; lines=0; gameOver=false;
    dropInterval=1000; lockDelay=0;
    elScore.textContent='0'; elLevel.textContent='1'; elLines.textContent='0';
    overlay.classList.add('hidden');
    spawnPiece();
    lastDrop = performance.now();
    requestAnimationFrame(gameLoop);
}

newGame();
