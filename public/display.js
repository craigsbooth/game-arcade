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
    else if (state.game === 'trivia') renderTrivia(content, turn);
    else if (state.game === 'blackjack') renderBlackjack(content, turn);
    else if (state.game === 'liarsdice') renderLiarsDice(content, turn);
    else if (state.game === 'connect4') renderConnect4(content, turn);
    else if (state.game === 'checkers') renderCheckers(content, turn);
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
    else if (state.game === 'trivia') winnerIdx = state.winner;
    else if (state.game === 'liarsdice') winnerIdx = state.ldWinner;
    else if (state.game === 'connect4') winnerIdx = state.c4Winner;
    else if (state.game === 'checkers') winnerIdx = state.ckWinner;

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

// ===== TRIVIA DISPLAY =====
function renderTrivia(content, turn) {
    const t = state;
    if (t.phase === 'final' || t.phase === 'finished') {
        renderWinner(content, turn);
        return;
    }

    turn.textContent = `Question ${t.currentQuestion + 1} of ${t.totalQuestions}`;

    if (t.phase === 'question') {
        content.innerHTML = `
            <div class="uno-display">
                <div style="margin-bottom:8px;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:2px">${t.category}</div>
                <h2 style="font-family:'Fredoka One',cursive;font-size:26px;margin-bottom:24px;max-width:600px">${t.question}</h2>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:500px;margin:0 auto 20px;">
                    ${t.answers.map((a, i) => `
                        <div style="padding:14px 20px;border-radius:12px;background:rgba(255,255,255,0.06);border:2px solid rgba(255,255,255,0.1);font-weight:700;font-size:15px;">
                            <span style="color:rgba(255,255,255,0.4);margin-right:8px">${['A','B','C','D'][i]}</span>${a}
                        </div>
                    `).join('')}
                </div>
                <div class="uno-action">${t.answeredCount} of ${t.totalPlayers} answered</div>
                <div class="uno-players" style="margin-top:16px">
                    ${state.players.map((p, i) => `
                        <div class="uno-player-card">
                            <div class="name">${p.name}</div>
                            <div class="cards">${t.scores[i]} <small>pts</small></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else if (t.phase === 'results') {
        content.innerHTML = `
            <div class="uno-display">
                <h2 style="font-family:'Fredoka One',cursive;font-size:22px;margin-bottom:20px">${t.question}</h2>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:500px;margin:0 auto 20px;">
                    ${t.answers.map((a, i) => `
                        <div style="padding:14px 20px;border-radius:12px;font-weight:700;font-size:15px;border:2px solid ${i === t.correct ? '#2ecc71' : 'rgba(255,255,255,0.05)'};background:${i === t.correct ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.03)'}">
                            ${i === t.correct ? '✓ ' : ''}${a}
                        </div>
                    `).join('')}
                </div>
                <div class="uno-players" style="margin-top:16px">
                    ${state.players.map((p, i) => `
                        <div class="uno-player-card">
                            <div class="name">${p.name}</div>
                            <div class="cards">${t.scores[i]} <small>pts</small></div>
                        </div>
                    `).join('')}
                </div>
                <button class="btn-primary" style="margin-top:20px" onclick="socket.emit('triviaNext')">Next Question →</button>
            </div>
        `;
    }
}

// ===== BLACKJACK DISPLAY =====
function renderBlackjack(content, turn) {
    const bj = state;
    if (bj.bjPhase === 'results') {
        turn.textContent = 'Round Over';
    } else {
        turn.textContent = bj.bjPhase === 'playing' ? `${state.players[bj.bjCurrentPlayer].name}'s Turn` : 'Dealer playing...';
    }

    const dealerCards = (bj.dealer || []).map(c => c ? `<span style="margin:0 3px;padding:6px 10px;border-radius:6px;background:#fff;color:${c.suit === '♥' || c.suit === '♦' ? '#c0392b' : '#2c3e50'};font-weight:800;font-size:14px">${c.value}${c.suit}</span>` : `<span style="margin:0 3px;padding:6px 10px;border-radius:6px;background:#1a5276;color:#fff;font-size:14px">??</span>`).join('');

    content.innerHTML = `
        <div class="uno-display">
            <div style="margin-bottom:24px">
                <div style="font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Dealer ${bj.dealerScore !== '?' ? `(${bj.dealerScore})` : ''}</div>
                <div>${dealerCards}</div>
            </div>
            <div class="uno-players">
                ${state.players.map((p, i) => {
                    const ph = bj.playerHands[i];
                    const cards = (ph.hand || []).map(c => `<span style="margin:0 2px;padding:4px 7px;border-radius:4px;background:#fff;color:${c.suit === '♥' || c.suit === '♦' ? '#c0392b' : '#2c3e50'};font-weight:700;font-size:12px">${c.value}${c.suit}</span>`).join('');
                    let status = '';
                    if (ph.busted) status = '💥 BUST';
                    else if (ph.stood) status = '✋ STAND';
                    else if (bj.bjPhase === 'results') {
                        const r = bj.results[i];
                        status = r.result === 'win' ? '🏆 WIN' : r.result === 'push' ? '🤝 PUSH' : '❌ LOSE';
                    }
                    return `
                        <div class="uno-player-card${i === bj.bjCurrentPlayer && bj.bjPhase === 'playing' ? ' active' : ''}">
                            <div class="name">${p.name}</div>
                            <div style="margin:6px 0">${cards}</div>
                            <div style="font-size:13px">${ph.score} ${status}</div>
                            <div class="cards">${ph.chips} <small>chips</small></div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${bj.bjPhase === 'results' ? `<button class="btn-primary" style="margin-top:20px" onclick="socket.emit('bjNewRound')">Deal Again</button>` : ''}
        </div>
    `;
}

// ===== LIAR'S DICE DISPLAY =====
function renderLiarsDice(content, turn) {
    const ld = state;
    if (ld.ldPhase === 'finished') {
        renderWinner(content, turn);
        return;
    }

    turn.textContent = ld.ldPhase === 'reveal' ? 'Challenge!' : `${state.players[state.currentPlayer].name}'s Turn`;

    const bidText = ld.currentBid ? `Current bid: <strong>${ld.currentBid.quantity}× ${['⚀','⚁','⚂','⚃','⚄','⚅'][ld.currentBid.face-1]}</strong> by ${state.players[ld.currentBid.player].name}` : 'No bid yet';

    let revealHTML = '';
    if (ld.ldPhase === 'reveal' && ld.roundResults) {
        const r = ld.roundResults;
        revealHTML = `
            <div style="padding:16px 24px;border-radius:12px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);margin-bottom:16px">
                <div style="font-weight:800;margin-bottom:6px">${state.players[r.challenger].name} challenged!</div>
                <div>Bid: ${r.bid.quantity}× ${'⚀⚁⚂⚃⚄⚅'[r.bid.face-1]} — Actual: ${r.actualCount}</div>
                <div style="margin-top:6px;font-weight:800;color:#e74c3c">${state.players[r.loser].name} loses a die!</div>
            </div>
            <button class="btn-primary" onclick="socket.emit('ldNextRound')">Next Round</button>
        `;
    }

    content.innerHTML = `
        <div class="uno-display">
            <div class="uno-action" style="margin-bottom:16px">${bidText}</div>
            ${revealHTML}
            <div class="uno-players">
                ${state.players.map((p, i) => {
                    const pd = ld.playerDice[i];
                    const diceStr = pd.dice ? pd.dice.map(d => '⚀⚁⚂⚃⚄⚅'[d-1]).join(' ') : '🎲'.repeat(pd.diceCount);
                    return `
                        <div class="uno-player-card${i === state.currentPlayer && ld.ldPhase === 'bidding' ? ' active' : ''}${!pd.alive ? ' style="opacity:0.3"' : ''}">
                            <div class="name">${p.name}</div>
                            <div style="font-size:22px;margin:6px 0">${pd.alive ? diceStr : '☠️'}</div>
                            <div style="font-size:12px;color:rgba(255,255,255,0.4)">${pd.diceCount} dice</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// ===== CONNECT 4 DISPLAY =====
function renderConnect4(content, turn) {
    if (state.phase === 'finished') { renderWinner(content, turn); return; }
    const cp = state.currentPlayer;
    turn.textContent = `${state.players[cp].name}'s Turn`;
    const colors = ['#ef4444','#facc15'];
    content.innerHTML = `
        <div style="text-align:center">
            <div style="display:inline-grid;grid-template-columns:repeat(7,48px);gap:4px;padding:12px;background:#1e40af;border-radius:12px;">
                ${state.c4Board.flat().map((cell,i) => `
                    <div style="width:48px;height:48px;border-radius:50%;background:${cell===null?'#1e3a5f':colors[cell]};border:2px solid rgba(0,0,0,0.2);${cell!==null?'box-shadow:inset 0 -3px 6px rgba(0,0,0,0.3)':''}"></div>
                `).join('')}
            </div>
        </div>
    `;
}

// ===== CHECKERS DISPLAY =====
function renderCheckers(content, turn) {
    if (state.phase === 'finished') { renderWinner(content, turn); return; }
    const cp = state.currentPlayer;
    turn.textContent = `${state.players[cp].name}'s Turn`;
    const board = state.ckBoard;
    const pieceMap = {0:'',1:'⚫',2:'⚪',3:'👑',4:'👑'};
    const cellColors = (r,c) => (r+c)%2===1 ? '#5c3d1e' : '#deb887';
    content.innerHTML = `
        <div style="text-align:center">
            <div style="display:inline-grid;grid-template-columns:repeat(8,44px);border:3px solid #3d2815;border-radius:4px;">
                ${board.flat().map((cell,i) => {
                    const r=Math.floor(i/8), c=i%8;
                    return `<div style="width:44px;height:44px;background:${cellColors(r,c)};display:flex;align-items:center;justify-content:center;font-size:24px">${cell===3?'<span style="color:#333">👑</span>':cell===4?'<span style="color:#eee">👑</span>':cell===1?'⚫':cell===2?'⚪':''}</div>`;
                }).join('')}
            </div>
        </div>
    `;
}
