// ===== PLAYER (MOBILE) CLIENT =====
const socket = io({
    transports: ['polling', 'websocket'],
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500
});

const UNO_SYMBOLS = { skip: '⊘', reverse: '⟳', draw2: '+2', wild: '★', wild4: '+4' };

let myIdx = null;
let roomCode = null;
let state = null;
let pendingWildCard = null;

// ===== DOM =====
const screens = document.querySelectorAll('.screen');
function showScreen(id) {
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ===== JOIN =====
document.getElementById('join-btn').addEventListener('click', () => {
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    const name = document.getElementById('player-name-input').value.trim();
    if (code.length !== 4) {
        showError('Enter a 4-character room code');
        return;
    }
    if (!socket.connected) {
        showError('Connecting to server, try again in a moment...');
        return;
    }
    socket.emit('joinRoom', { code, playerName: name || 'Player' });
});

document.getElementById('room-code-input').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') document.getElementById('join-btn').click();
});

function showError(msg) {
    const el = document.getElementById('join-error');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

socket.on('error', ({ msg }) => showError(msg));

socket.on('joinedRoom', ({ code, playerIdx }) => {
    roomCode = code;
    myIdx = playerIdx;
    showScreen('lobby-screen');
});

// ===== STATE =====
socket.on('playerState', (s) => {
    state = s;
    renderState();
});

function renderState() {
    if (!state) return;

    if (state.phase === 'lobby') {
        showScreen('lobby-screen');
        renderLobby();
    } else {
        showScreen('game-screen');
        renderGame();
    }
}

function renderLobby() {
    const list = document.getElementById('lobby-players');
    list.innerHTML = '';
    state.players.forEach(p => {
        const chip = document.createElement('div');
        chip.className = 'lobby-chip';
        chip.textContent = p.name;
        list.appendChild(chip);
    });
}

function renderGame() {
    const content = document.getElementById('game-content');

    if (state.phase === 'finished') {
        renderWinner(content);
        return;
    }

    if (state.game === 'uno') renderUnoPlayer(content);
    else if (state.game === 'battleships') renderBsPlayer(content);
    else if (state.game === 'guesswho') renderGwPlayer(content);
}

// ===== UNO PLAYER =====
function renderUnoPlayer(content) {
    const isMyTurn = state.isMyTurn;
    const hand = state.hand;
    const top = state.topCard;
    const mustDraw = state.mustDraw;

    content.innerHTML = `
        <div class="player-header">
            <span class="turn-text">${state.players[state.currentPlayer].name}'s Turn</span>
            ${isMyTurn ? '<span class="my-turn-badge">YOUR TURN</span>' : '<span class="wait-badge">WAITING</span>'}
        </div>
        <div class="hand-section">
            <div class="hand-label">Your Hand (${hand.length} cards)</div>
            <div class="hand-grid" id="hand-grid"></div>
        </div>
        ${isMyTurn ? `<button class="draw-btn" id="draw-btn">${mustDraw > 0 ? `Draw ${mustDraw} cards` : 'Draw a card'}</button>` : ''}
    `;

    const grid = document.getElementById('hand-grid');
    hand.forEach((card, idx) => {
        const el = document.createElement('div');
        const colorCls = card.color === 'wild' ? 'color-wild' : `color-${card.color}`;
        const canPlay = isMyTurn && unoCanPlay(card);
        el.className = `hand-card ${colorCls} ${canPlay ? 'playable' : 'not-playable'}`;
        el.innerHTML = `<span>${UNO_SYMBOLS[card.value] || card.value}</span>`;

        if (canPlay) {
            el.addEventListener('click', () => {
                if (card.color === 'wild') {
                    pendingWildCard = idx;
                    showColorPicker();
                } else {
                    socket.emit('unoPlay', { cardIdx: idx });
                }
            });
        }
        grid.appendChild(el);
    });

    if (isMyTurn) {
        document.getElementById('draw-btn').addEventListener('click', () => {
            socket.emit('unoDraw');
        });
    }
}

function unoCanPlay(card) {
    const top = state.topCard;
    if (state.mustDraw > 0) {
        if (top.value === 'draw2' && card.value === 'draw2') return true;
        if (top.value === 'wild4' && card.value === 'wild4') return true;
        return false;
    }
    if (card.color === 'wild') return true;
    if (card.color === state.currentColor) return true;
    if (card.value === top.value) return true;
    return false;
}

function showColorPicker() {
    const overlay = document.createElement('div');
    overlay.className = 'color-picker-overlay';
    overlay.innerHTML = `
        <div class="color-picker-box">
            <h3>Choose Color</h3>
            <div class="color-picker-grid">
                <button class="color-pick-btn" data-color="red" style="background:#E74C3C"></button>
                <button class="color-pick-btn" data-color="blue" style="background:#3498DB"></button>
                <button class="color-pick-btn" data-color="green" style="background:#2ECC71"></button>
                <button class="color-pick-btn" data-color="yellow" style="background:#F1C40F"></button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('.color-pick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            socket.emit('unoPlay', { cardIdx: pendingWildCard, chosenColor: btn.dataset.color });
            pendingWildCard = null;
            overlay.remove();
        });
    });
}

// ===== BATTLESHIPS PLAYER =====
let bsSelectedShip = 0;
let bsOrientation = 'horizontal';
const BS_SHIPS = [
    { name: 'Carrier', size: 5 },
    { name: 'Battleship', size: 4 },
    { name: 'Cruiser', size: 3 },
    { name: 'Submarine', size: 3 },
    { name: 'Destroyer', size: 2 }
];

function renderBsPlayer(content) {
    if (state.phase === 'placement') {
        renderBsPlacement(content);
    } else {
        renderBsBattle(content);
    }
}

function renderBsPlacement(content) {
    if (state.myPlacementDone) {
        content.innerHTML = `
            <div class="player-header">
                <span class="turn-text">Fleet Deployed ✓</span>
                <span class="wait-badge">WAITING FOR OPPONENT</span>
            </div>
            <p style="color:rgba(255,255,255,0.5);margin-top:20px;">Your ships are in position. Waiting for the enemy to finish deploying...</p>
        `;
        return;
    }

    const placed = state.myShips.map(s => s.name);

    content.innerHTML = `
        <div class="player-header">
            <span class="turn-text">Deploy Your Fleet</span>
        </div>
        <div class="ship-picker" id="ship-picker"></div>
        <div class="bs-controls">
            <button class="btn-secondary" id="bs-rotate">↻ Rotate</button>
        </div>
        <div class="bs-player-grid" id="bs-placement-grid"></div>
    `;

    // Ship picker
    const picker = document.getElementById('ship-picker');
    BS_SHIPS.forEach((ship, idx) => {
        const isPlaced = placed.includes(ship.name);
        const item = document.createElement('div');
        item.className = `ship-pick-item${idx === bsSelectedShip ? ' selected' : ''}${isPlaced ? ' placed' : ''}`;
        item.innerHTML = `
            <div class="ship-dots">${'<div class="ship-dot"></div>'.repeat(ship.size)}</div>
            <span class="ship-pick-name">${ship.name} (${ship.size})</span>
        `;
        if (!isPlaced) {
            item.addEventListener('click', () => { bsSelectedShip = idx; renderBsPlayer(content); });
        }
        picker.appendChild(item);
    });

    // Rotate
    document.getElementById('bs-rotate').addEventListener('click', () => {
        bsOrientation = bsOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    });

    // Grid
    const grid = document.getElementById('bs-placement-grid');
    const myGrid = state.myGrid;
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const cell = document.createElement('div');
            cell.className = 'bs-p-cell';
            if (myGrid[r][c] === 1) cell.classList.add('ship');
            cell.addEventListener('click', () => bsTryPlace(r, c));
            grid.appendChild(cell);
        }
    }
}

function bsTryPlace(row, col) {
    const placed = state.myShips.map(s => s.name);
    const ship = BS_SHIPS[bsSelectedShip];
    if (placed.includes(ship.name)) return;

    const cells = [];
    for (let i = 0; i < ship.size; i++) {
        const r = bsOrientation === 'horizontal' ? row : row + i;
        const c = bsOrientation === 'horizontal' ? col + i : col;
        cells.push([r, c]);
    }

    socket.emit('bsPlace', { shipName: ship.name, cells });

    // Auto-select next unplaced
    const nextIdx = BS_SHIPS.findIndex((s, i) => i > bsSelectedShip && !placed.includes(s.name) && s.name !== ship.name);
    if (nextIdx !== -1) bsSelectedShip = nextIdx;
}

function renderBsBattle(content) {
    const isMyTurn = state.isMyTurn;

    content.innerHTML = `
        <div class="player-header">
            <span class="turn-text">${state.players[state.currentPlayer].name}'s Turn</span>
            ${isMyTurn ? '<span class="my-turn-badge">FIRE!</span>' : '<span class="wait-badge">WAITING</span>'}
        </div>
        <div class="hand-label" style="margin-top:10px">Enemy Waters — Tap to fire</div>
        <div class="bs-player-grid" id="bs-enemy-grid"></div>
        <div class="hand-label" style="margin-top:14px">Your Fleet</div>
        <div class="bs-player-grid" id="bs-own-grid" style="opacity:0.7"></div>
    `;

    // Enemy grid
    const enemyGrid = document.getElementById('bs-enemy-grid');
    const eg = state.enemyGrid;
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const cell = document.createElement('div');
            cell.className = 'bs-p-cell';
            const val = eg[r][c];
            if (val === 2) { cell.classList.add('hit'); cell.textContent = '✕'; }
            else if (val === 3) { cell.classList.add('miss'); cell.textContent = '•'; }
            else if (isMyTurn) {
                cell.addEventListener('click', () => socket.emit('bsFire', { row: r, col: c }));
            }
            enemyGrid.appendChild(cell);
        }
    }

    // Own grid
    const ownGrid = document.getElementById('bs-own-grid');
    const mg = state.myGrid;
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const cell = document.createElement('div');
            cell.className = 'bs-p-cell';
            const val = mg[r][c];
            if (val === 1) cell.classList.add('ship');
            else if (val === 2) { cell.classList.add('hit'); cell.textContent = '✕'; }
            else if (val === 3) { cell.classList.add('miss'); cell.textContent = '•'; }
            ownGrid.appendChild(cell);
        }
    }
}

// ===== GUESS WHO PLAYER =====
function renderGwPlayer(content) {
    const isMyTurn = state.isMyTurn;
    const secret = state.secret;
    const eliminated = new Set(state.eliminated);
    const chars = state.characters;

    content.innerHTML = `
        <div class="player-header">
            <span class="turn-text">${state.players[state.currentPlayer].name}'s Turn</span>
            ${isMyTurn ? '<span class="my-turn-badge">YOUR TURN</span>' : '<span class="wait-badge">WAITING</span>'}
        </div>
        <div class="gw-secret-bar">
            <span>Their secret:</span>
            <div class="face" style="background:${secret.bg}">${secret.emoji}</div>
            <strong>${secret.name}</strong>
        </div>
        <div class="gw-player-board" id="gw-board"></div>
        ${isMyTurn ? `
            <div class="gw-actions">
                <button class="gw-guess-btn" id="gw-guess-btn">🎯 Guess</button>
                <button class="gw-end-turn-btn" id="gw-end-turn-btn">Done → End Turn</button>
            </div>
        ` : ''}
    `;

    const board = document.getElementById('gw-board');
    chars.forEach((char, idx) => {
        const el = document.createElement('div');
        el.className = `gw-p-char${eliminated.has(idx) ? ' eliminated' : ''}`;
        el.innerHTML = `
            <div class="face" style="background:${char.bg}">${char.emoji}</div>
            <div class="name">${char.name}</div>
            <div class="traits">${char.traits.join(', ')}</div>
        `;
        el.addEventListener('click', () => {
            if (eliminated.has(idx)) eliminated.delete(idx);
            else eliminated.add(idx);
            socket.emit('gwEliminate', { eliminated: [...eliminated] });
        });
        board.appendChild(el);
    });

    if (isMyTurn) {
        document.getElementById('gw-end-turn-btn').addEventListener('click', () => {
            socket.emit('gwEndTurn');
        });
        document.getElementById('gw-guess-btn').addEventListener('click', () => {
            showGwGuessPicker(chars);
        });
    }
}

function showGwGuessPicker(chars) {
    const overlay = document.createElement('div');
    overlay.className = 'color-picker-overlay';
    overlay.innerHTML = `
        <div style="text-align:center;max-height:80vh;overflow-y:auto;padding:20px;">
            <h3 style="font-family:'Fredoka One',cursive;margin-bottom:15px;">Who is their character?</h3>
            <div class="gw-player-board" id="gw-guess-grid" style="max-width:340px;"></div>
            <button class="btn-secondary" style="margin-top:15px" id="gw-cancel-guess">Cancel</button>
        </div>
    `;
    document.body.appendChild(overlay);

    const grid = overlay.querySelector('#gw-guess-grid');
    chars.forEach(char => {
        const el = document.createElement('div');
        el.className = 'gw-p-char';
        el.innerHTML = `
            <div class="face" style="background:${char.bg}">${char.emoji}</div>
            <div class="name">${char.name}</div>
        `;
        el.addEventListener('click', () => {
            socket.emit('gwGuess', { charName: char.name });
            overlay.remove();
        });
        grid.appendChild(el);
    });

    overlay.querySelector('#gw-cancel-guess').addEventListener('click', () => overlay.remove());
}

// ===== WINNER =====
function renderWinner(content) {
    let winnerIdx = null;
    if (state.game === 'uno') winnerIdx = state.winner;
    else if (state.game === 'battleships') winnerIdx = state.winner;
    else if (state.game === 'guesswho') winnerIdx = state.winner;

    const isWinner = winnerIdx === state.playerIdx;
    content.innerHTML = `
        <div class="player-winner">
            <div class="icon">${isWinner ? '🏆' : '😢'}</div>
            <h2>${isWinner ? 'You Win!' : `${state.players[winnerIdx].name} Wins`}</h2>
            <p>${isWinner ? 'Congratulations!' : 'Better luck next time!'}</p>
        </div>
    `;
}
