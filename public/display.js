// ===== HOST DISPLAY CLIENT =====
const socket = io({
    transports: ['polling', 'websocket'],
    upgrade: true
});

const UNO_SYMBOLS = { skip: '⊘', reverse: '⟳', draw2: '+2', wild: '★', wild4: '+4' };
const COLOR_HEX = { red: '#E74C3C', blue: '#3498DB', green: '#2ECC71', yellow: '#F1C40F' };

let currentRoom = null;
let state = null;

// ===== DOM =====
const screens = document.querySelectorAll('.screen');
function showScreen(id) {
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ===== LANDING =====
document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
        const game = card.dataset.game;
        socket.emit('createRoom', { game, playerName: 'Host' });
    });
});

socket.on('roomCreated', ({ code, playerIdx }) => {
    currentRoom = code;
    document.getElementById('room-code').textContent = code;

    // Fetch the real network IP and show QR code
    fetch('/api/server-info')
        .then(r => r.json())
        .then(info => {
            const joinUrl = info.joinUrl;
            document.getElementById('join-url').textContent = joinUrl;

            // Generate QR code
            const qr = qrcode(0, 'M');
            qr.addData(joinUrl);
            qr.make();
            document.getElementById('qr-code').innerHTML = qr.createImgTag(5, 8);
        })
        .catch(() => {
            document.getElementById('join-url').textContent = `${window.location.origin}/join.html`;
        });

    showScreen('lobby');
});

// Start game button
document.getElementById('start-game-btn').addEventListener('click', () => {
    socket.emit('startGame');
});

// ===== GAME STATE =====
socket.on('gameState', (s) => {
    state = s;
    renderState();
});

function renderState() {
    if (!state) return;

    if (state.phase === 'lobby') {
        showScreen('lobby');
        renderLobby();
    } else {
        showScreen('display');
        document.getElementById('disp-room-code').textContent = state.roomCode;
        renderDisplay();
    }
}

function renderLobby() {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    state.players.forEach(p => {
        const chip = document.createElement('div');
        chip.className = `player-chip${p.connected ? '' : ' disconnected'}`;
        chip.textContent = p.name;
        list.appendChild(chip);
    });

    const btn = document.getElementById('start-game-btn');
    const minPlayers = state.game === 'uno' ? 2 : 2;
    if (state.players.length >= minPlayers) {
        btn.disabled = false;
        btn.textContent = 'START GAME';
    } else {
        btn.disabled = true;
        btn.textContent = `Need ${minPlayers - state.players.length} more player(s)`;
    }
}

function renderDisplay() {
    const turn = document.getElementById('disp-turn');
    const content = document.getElementById('display-content');

    if (state.phase === 'finished') {
        renderWinner(content, turn);
        return;
    }

    if (state.game === 'uno') renderUno(content, turn);
    else if (state.game === 'battleships') renderBattleships(content, turn);
    else if (state.game === 'guesswho') renderGuessWho(content, turn);
}

// ===== UNO DISPLAY =====
function renderUno(content, turn) {
    const cp = state.currentPlayer;
    turn.textContent = `${state.players[cp].name}'s Turn`;

    const top = state.topCard;
    const colorClass = top.color === 'wild' ? 'color-wild' : `color-${state.currentColor}`;
    const valueText = UNO_SYMBOLS[top.value] || top.value;

    content.innerHTML = `
        <div class="uno-display">
            <div class="uno-center">
                <div class="uno-top-card ${colorClass}"><span>${valueText}</span></div>
                <div class="uno-info">
                    <div class="uno-color-dot" style="background:${COLOR_HEX[state.currentColor] || '#666'}"></div>
                    <div class="uno-direction">${state.direction === 1 ? '→ Clockwise' : '← Counter-clockwise'}</div>
                    ${state.mustDraw > 0 ? `<div style="color:#e74c3c;font-weight:800">+${state.mustDraw} pending</div>` : ''}
                </div>
            </div>
            <div class="uno-players">
                ${state.players.map((p, i) => `
                    <div class="uno-player-card${i === cp ? ' active' : ''}">
                        <div class="name">${p.name}</div>
                        <div class="cards">${state.handSizes[i]} <small>cards</small></div>
                    </div>
                `).join('')}
            </div>
            ${state.lastAction ? `<div class="uno-action">${state.lastAction}</div>` : ''}
        </div>
    `;
}

// ===== BATTLESHIPS DISPLAY =====
function renderBattleships(content, turn) {
    if (state.phase === 'placement') {
        turn.textContent = 'Placing ships...';
        content.innerHTML = `
            <div class="bs-display">
                <h2 style="margin-bottom:20px;font-family:'Fredoka One',cursive">Waiting for players to deploy fleets...</h2>
                <div class="bs-status">
                    ${state.players.map((p, i) => `
                        <div class="bs-status-item">${p.name}: ${state.placementDone[i] ? '✅ Ready' : '⏳ Deploying'}</div>
                    `).join('')}
                </div>
            </div>
        `;
        return;
    }

    const cp = state.currentPlayer;
    turn.textContent = `${state.players[cp].name}'s Turn`;

    content.innerHTML = `
        <div class="bs-display">
            <div class="bs-grids">
                ${state.grids.map((grid, i) => `
                    <div class="bs-grid-section">
                        <h3>${state.players[i].name}'s Waters</h3>
                        <div class="bs-grid">
                            ${grid.flat().map(cell => {
                                let cls = 'bs-cell';
                                let txt = '';
                                if (cell === 2) { cls += ' hit'; txt = '✕'; }
                                else if (cell === 3) { cls += ' miss'; txt = '•'; }
                                return `<div class="${cls}">${txt}</div>`;
                            }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="bs-status">
                ${state.players.map((p, i) => `
                    <div class="bs-status-item">${p.name}: <strong>${state.shipsRemaining[i]}</strong> ships remaining</div>
                `).join('')}
            </div>
            ${state.lastShot ? `<div class="uno-action">${state.players[state.lastShot.player].name} fired — ${state.lastShot.result.toUpperCase()}${state.lastShot.sunk ? ` (${state.lastShot.sunk} SUNK!)` : ''}</div>` : ''}
        </div>
    `;
}

// ===== GUESS WHO DISPLAY =====
function renderGuessWho(content, turn) {
    const cp = state.currentPlayer;
    turn.textContent = `${state.players[cp].name}'s Turn`;

    content.innerHTML = `
        <div class="gw-display">
            <div class="gw-board">
                ${state.characters.map(c => `
                    <div class="gw-char">
                        <div class="face" style="background:${c.bg}">${c.emoji}</div>
                        <div class="name">${c.name}</div>
                    </div>
                `).join('')}
            </div>
            ${state.lastAction ? `<div class="uno-action">${state.lastAction}</div>` : ''}
        </div>
    `;
}

// ===== WINNER =====
function renderWinner(content, turn) {
    turn.textContent = 'Game Over';
    let winnerIdx = null;
    if (state.game === 'uno') winnerIdx = state.winner;
    else if (state.game === 'battleships') winnerIdx = state.winner;
    else if (state.game === 'guesswho') winnerIdx = state.winner;

    const winnerName = winnerIdx !== null ? state.players[winnerIdx].name : 'Unknown';

    content.innerHTML = `
        <div class="winner-overlay">
            <div class="icon">🏆</div>
            <h1>${winnerName} Wins!</h1>
            <p>${state.lastAction || 'Congratulations!'}</p>
            <button class="btn-primary" onclick="document.querySelector('.btn-primary').disabled=true; socket.emit('restart');">PLAY AGAIN</button>
        </div>
    `;
}
