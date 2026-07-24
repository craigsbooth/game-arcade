const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ===== ROOM MANAGEMENT =====
const rooms = new Map();

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function getRoom(code) {
    return rooms.get(code);
}

function broadcastRoom(code) {
    const room = getRoom(code);
    if (!room) return;

    // Send display state
    io.to(`display-${code}`).emit('gameState', getDisplayState(room));

    // Send individual player states
    room.players.forEach((player, idx) => {
        if (player.socketId) {
            io.to(player.socketId).emit('playerState', getPlayerState(room, idx));
        }
    });
}

function getDisplayState(room) {
    const base = {
        game: room.game,
        phase: room.phase,
        roomCode: room.code,
        players: room.players.map(p => ({ name: p.name, connected: !!p.socketId })),
        currentPlayer: room.currentPlayer,
        settings: room.settings || {}
    };

    if (room.game === 'uno' && room.uno) {
        base.direction = room.uno.direction;
        base.topCard = room.uno.discardPile[room.uno.discardPile.length - 1];
        base.currentColor = room.uno.currentColor;
        base.handSizes = room.players.map(p => p.hand ? p.hand.length : 0);
        base.mustDraw = room.uno.mustDraw;
        base.lastAction = room.uno.lastAction || null;
        base.winner = room.uno.winner;
    } else if (room.game === 'battleships' && room.battleships) {
        base.grids = room.battleships.grids.map((grid, idx) => {
            // Display shows hits/misses but not unrevealed ship positions
            return grid.map(row => row.map(cell => cell >= 2 ? cell : 0));
        });
        base.shipsRemaining = room.battleships.shipsRemaining;
        base.lastShot = room.battleships.lastShot;
        base.winner = room.battleships.winner;
        base.placementDone = room.battleships.placementDone;
    } else if (room.game === 'guesswho' && room.guesswho) {
        base.winner = room.guesswho.winner;
        base.lastAction = room.guesswho.lastAction;
        base.characters = room.guesswho.characters.map(c => ({ name: c.name, emoji: c.emoji, bg: c.bg }));
    }

    return base;
}

function getPlayerState(room, playerIdx) {
    const base = {
        game: room.game,
        phase: room.phase,
        playerIdx,
        playerName: room.players[playerIdx].name,
        currentPlayer: room.currentPlayer,
        isMyTurn: room.currentPlayer === playerIdx,
        players: room.players.map(p => ({ name: p.name }))
    };

    if (room.game === 'uno' && room.uno) {
        base.hand = room.players[playerIdx].hand || [];
        base.topCard = room.uno.discardPile[room.uno.discardPile.length - 1];
        base.currentColor = room.uno.currentColor;
        base.direction = room.uno.direction;
        base.mustDraw = room.uno.mustDraw;
        base.handSizes = room.players.map(p => p.hand ? p.hand.length : 0);
        base.winner = room.uno.winner;
    } else if (room.game === 'battleships' && room.battleships) {
        base.myGrid = room.battleships.grids[playerIdx];
        base.enemyGrid = room.battleships.grids[1 - playerIdx].map(row =>
            row.map(cell => cell >= 2 ? cell : 0)
        );
        base.shipsRemaining = room.battleships.shipsRemaining;
        base.myShips = room.players[playerIdx].ships || [];
        base.placementDone = room.battleships.placementDone;
        base.myPlacementDone = room.players[playerIdx].placementDone || false;
        base.winner = room.battleships.winner;
    } else if (room.game === 'guesswho' && room.guesswho) {
        base.secret = room.players[playerIdx].secret;
        base.eliminated = room.players[playerIdx].eliminated || [];
        base.characters = room.guesswho.characters;
        base.winner = room.guesswho.winner;
    }

    return base;
}

// ===== UNO LOGIC =====
const UNO_COLORS = ['red', 'blue', 'green', 'yellow'];
const UNO_VALUES = ['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2'];

function createUnoDeck() {
    const deck = [];
    UNO_COLORS.forEach(color => {
        deck.push({ color, value: '0' });
        for (let i = 0; i < 2; i++) {
            UNO_VALUES.slice(1).forEach(value => deck.push({ color, value }));
        }
    });
    for (let i = 0; i < 4; i++) {
        deck.push({ color: 'wild', value: 'wild' });
        deck.push({ color: 'wild', value: 'wild4' });
    }
    return shuffle(deck);
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function startUnoGame(room) {
    const numPlayers = room.players.length;
    room.uno = {
        deck: createUnoDeck(),
        discardPile: [],
        direction: 1,
        currentColor: null,
        mustDraw: 0,
        lastAction: null,
        winner: null
    };

    // Deal 7 cards each
    room.players.forEach(p => { p.hand = []; });
    for (let i = 0; i < 7; i++) {
        room.players.forEach(p => p.hand.push(room.uno.deck.pop()));
    }

    // First card (must be a number)
    let first;
    do {
        first = room.uno.deck.pop();
        if (first.color === 'wild' || ['skip','reverse','draw2'].includes(first.value)) {
            room.uno.deck.unshift(first);
            room.uno.deck = shuffle(room.uno.deck);
            first = null;
        }
    } while (!first);

    room.uno.discardPile.push(first);
    room.uno.currentColor = first.color;
    room.currentPlayer = 0;
    room.phase = 'playing';
}

function unoCanPlay(room, card) {
    const top = room.uno.discardPile[room.uno.discardPile.length - 1];
    if (room.uno.mustDraw > 0) {
        if (top.value === 'draw2' && card.value === 'draw2') return true;
        if (top.value === 'wild4' && card.value === 'wild4') return true;
        return false;
    }
    if (card.color === 'wild') return true;
    if (card.color === room.uno.currentColor) return true;
    if (card.value === top.value) return true;
    return false;
}

function unoDrawFromDeck(room) {
    if (room.uno.deck.length === 0) {
        if (room.uno.discardPile.length <= 1) return null;
        const top = room.uno.discardPile.pop();
        room.uno.deck = shuffle(room.uno.discardPile);
        room.uno.discardPile = [top];
    }
    return room.uno.deck.pop();
}

function unoNextTurn(room) {
    const n = room.players.length;
    room.currentPlayer = ((room.currentPlayer + room.uno.direction) % n + n) % n;
}

function unoPlayCard(room, playerIdx, cardIdx, chosenColor) {
    if (room.currentPlayer !== playerIdx) return false;
    const hand = room.players[playerIdx].hand;
    if (cardIdx < 0 || cardIdx >= hand.length) return false;
    const card = hand[cardIdx];
    if (!unoCanPlay(room, card)) return false;

    hand.splice(cardIdx, 1);
    room.uno.discardPile.push(card);

    if (card.color === 'wild') {
        room.uno.currentColor = chosenColor || 'red';
    } else {
        room.uno.currentColor = card.color;
    }

    // Check win
    if (hand.length === 0) {
        room.uno.winner = playerIdx;
        room.phase = 'finished';
        room.uno.lastAction = `${room.players[playerIdx].name} wins!`;
        return true;
    }

    room.uno.lastAction = `${room.players[playerIdx].name} played ${card.value}`;

    // Apply effects
    const n = room.players.length;
    switch (card.value) {
        case 'skip':
            unoNextTurn(room);
            unoNextTurn(room);
            break;
        case 'reverse':
            if (n === 2) {
                unoNextTurn(room);
                unoNextTurn(room);
            } else {
                room.uno.direction *= -1;
                unoNextTurn(room);
            }
            break;
        case 'draw2':
            room.uno.mustDraw += 2;
            unoNextTurn(room);
            break;
        case 'wild4':
            room.uno.mustDraw += 4;
            unoNextTurn(room);
            break;
        default:
            unoNextTurn(room);
    }
    return true;
}

function unoDrawCard(room, playerIdx) {
    if (room.currentPlayer !== playerIdx) return false;

    if (room.uno.mustDraw > 0) {
        for (let i = 0; i < room.uno.mustDraw; i++) {
            const c = unoDrawFromDeck(room);
            if (c) room.players[playerIdx].hand.push(c);
        }
        room.uno.lastAction = `${room.players[playerIdx].name} drew ${room.uno.mustDraw} cards`;
        room.uno.mustDraw = 0;
        unoNextTurn(room);
        return true;
    }

    const c = unoDrawFromDeck(room);
    if (c) {
        room.players[playerIdx].hand.push(c);
        room.uno.lastAction = `${room.players[playerIdx].name} drew a card`;
    }
    unoNextTurn(room);
    return true;
}

// ===== BATTLESHIPS LOGIC =====
const BS_SHIPS = [
    { name: 'Carrier', size: 5 },
    { name: 'Battleship', size: 4 },
    { name: 'Cruiser', size: 3 },
    { name: 'Submarine', size: 3 },
    { name: 'Destroyer', size: 2 }
];

function startBattleshipsGame(room) {
    room.battleships = {
        grids: [
            Array.from({length:10}, () => Array(10).fill(0)),
            Array.from({length:10}, () => Array(10).fill(0))
        ],
        shipsRemaining: [5, 5],
        placementDone: [false, false],
        lastShot: null,
        winner: null
    };
    room.players.forEach(p => { p.ships = []; p.placementDone = false; });
    room.currentPlayer = 0;
    room.phase = 'placement';
}

function bsPlaceShip(room, playerIdx, shipName, cells) {
    const grid = room.battleships.grids[playerIdx];
    const shipDef = BS_SHIPS.find(s => s.name === shipName);
    if (!shipDef) return false;
    if (cells.length !== shipDef.size) return false;
    if (room.players[playerIdx].ships.find(s => s.name === shipName)) return false;

    // Validate cells
    for (const [r, c] of cells) {
        if (r < 0 || r >= 10 || c < 0 || c >= 10) return false;
        if (grid[r][c] !== 0) return false;
    }

    // Check cells are in a line
    const rows = cells.map(c => c[0]);
    const cols = cells.map(c => c[1]);
    const sameRow = rows.every(r => r === rows[0]);
    const sameCol = cols.every(c => c === cols[0]);
    if (!sameRow && !sameCol) return false;

    // Place
    cells.forEach(([r, c]) => { grid[r][c] = 1; });
    room.players[playerIdx].ships.push({ name: shipName, size: shipDef.size, cells, hits: 0 });

    // Check if all placed
    if (room.players[playerIdx].ships.length === BS_SHIPS.length) {
        room.players[playerIdx].placementDone = true;
        room.battleships.placementDone[playerIdx] = true;

        if (room.battleships.placementDone.every(Boolean)) {
            room.phase = 'playing';
            room.currentPlayer = 0;
        }
    }
    return true;
}

function bsFire(room, playerIdx, row, col) {
    if (room.currentPlayer !== playerIdx) return false;
    if (room.phase !== 'playing') return false;
    const enemy = 1 - playerIdx;
    const grid = room.battleships.grids[enemy];

    if (row < 0 || row >= 10 || col < 0 || col >= 10) return false;
    if (grid[row][col] >= 2) return false; // already shot

    if (grid[row][col] === 1) {
        grid[row][col] = 2; // hit
        room.battleships.lastShot = { player: playerIdx, row, col, result: 'hit' };

        // Check if ship sunk
        const ship = room.players[enemy].ships.find(s =>
            s.cells.some(([r, c]) => r === row && c === col)
        );
        if (ship) {
            ship.hits++;
            if (ship.hits >= ship.size) {
                room.battleships.shipsRemaining[enemy]--;
                room.battleships.lastShot.sunk = ship.name;

                if (room.battleships.shipsRemaining[enemy] === 0) {
                    room.battleships.winner = playerIdx;
                    room.phase = 'finished';
                    return true;
                }
            }
        }
    } else {
        grid[row][col] = 3; // miss
        room.battleships.lastShot = { player: playerIdx, row, col, result: 'miss' };
    }

    room.currentPlayer = 1 - playerIdx;
    return true;
}

// ===== GUESS WHO LOGIC =====
const GW_CHARACTERS = [
    { name: 'Alex', emoji: '👨', bg: '#3498db', traits: ['male','brown hair','glasses'] },
    { name: 'Beth', emoji: '👩', bg: '#e74c3c', traits: ['female','red hair','earrings'] },
    { name: 'Carlos', emoji: '👨‍🦱', bg: '#2ecc71', traits: ['male','curly hair','beard'] },
    { name: 'Diana', emoji: '👩‍🦰', bg: '#9b59b6', traits: ['female','ginger','freckles'] },
    { name: 'Erik', emoji: '👴', bg: '#f39c12', traits: ['male','white hair','mustache'] },
    { name: 'Fiona', emoji: '👩‍🦳', bg: '#1abc9c', traits: ['female','white hair','glasses'] },
    { name: 'George', emoji: '🧔', bg: '#e67e22', traits: ['male','black hair','beard'] },
    { name: 'Hannah', emoji: '👧', bg: '#fd79a8', traits: ['female','blonde','young'] },
    { name: 'Ivan', emoji: '👨‍🦲', bg: '#636e72', traits: ['male','bald','tall'] },
    { name: 'Julia', emoji: '👩‍🦱', bg: '#a29bfe', traits: ['female','curly hair','hat'] },
    { name: 'Kevin', emoji: '🧑', bg: '#00b894', traits: ['male','brown hair','young'] },
    { name: 'Luna', emoji: '👩‍🎤', bg: '#6c5ce7', traits: ['female','black hair','earrings'] },
    { name: 'Marco', emoji: '👨‍🎓', bg: '#0984e3', traits: ['male','glasses','brown hair'] },
    { name: 'Nina', emoji: '👩‍💼', bg: '#d63031', traits: ['female','black hair','tall'] },
    { name: 'Oscar', emoji: '🧓', bg: '#b2bec3', traits: ['male','gray hair','glasses'] },
    { name: 'Penny', emoji: '👱‍♀️', bg: '#fdcb6e', traits: ['female','blonde','freckles'] },
    { name: 'Quinn', emoji: '🧑‍🦰', bg: '#e17055', traits: ['male','ginger','freckles'] },
    { name: 'Rosa', emoji: '👩‍🔬', bg: '#00cec9', traits: ['female','brown hair','glasses'] },
    { name: 'Sam', emoji: '👨‍🎨', bg: '#fab1a0', traits: ['male','blonde','hat'] },
    { name: 'Tara', emoji: '🧕', bg: '#55a3e0', traits: ['female','black hair','hat'] },
    { name: 'Umar', emoji: '👨‍⚕️', bg: '#00b894', traits: ['male','black hair','mustache'] },
    { name: 'Vera', emoji: '👩‍🏫', bg: '#e84393', traits: ['female','brown hair','tall'] },
    { name: 'Will', emoji: '🧔‍♂️', bg: '#2d3436', traits: ['male','black hair','beard'] },
    { name: 'Zoe', emoji: '👩‍🎤', bg: '#a855f7', traits: ['female','red hair','young'] }
];

function startGuessWhoGame(room) {
    const shuffled = shuffle([...GW_CHARACTERS]);
    room.guesswho = {
        characters: GW_CHARACTERS,
        winner: null,
        lastAction: null
    };
    room.players[0].secret = shuffled[0];
    room.players[1].secret = shuffled[1];
    room.players[0].eliminated = [];
    room.players[1].eliminated = [];
    room.currentPlayer = 0;
    room.phase = 'playing';
}

function gwEliminate(room, playerIdx, charIndices) {
    room.players[playerIdx].eliminated = charIndices;
    return true;
}

function gwGuess(room, playerIdx, charName) {
    const enemy = 1 - playerIdx;
    const actual = room.players[enemy].secret;

    if (charName === actual.name) {
        room.guesswho.winner = playerIdx;
        room.guesswho.lastAction = `${room.players[playerIdx].name} correctly guessed ${charName}!`;
    } else {
        room.guesswho.winner = enemy;
        room.guesswho.lastAction = `${room.players[playerIdx].name} guessed wrong! It was ${actual.name}`;
    }
    room.phase = 'finished';
    return true;
}

function gwEndTurn(room, playerIdx) {
    if (room.currentPlayer !== playerIdx) return false;
    room.currentPlayer = 1 - playerIdx;
    room.guesswho.lastAction = `${room.players[1 - playerIdx].name}'s turn`;
    return true;
}

// ===== SOCKET.IO =====
io.on('connection', (socket) => {

    // HOST creates a room
    socket.on('createRoom', ({ game, playerName }) => {
        let code;
        do { code = generateCode(); } while (rooms.has(code));

        const room = {
            code,
            game,
            phase: 'lobby',
            players: [{ name: playerName || 'Player 1', socketId: socket.id, isHost: true }],
            currentPlayer: 0,
            settings: { maxPlayers: game === 'uno' ? 10 : 2 }
        };
        rooms.set(code, room);

        socket.join(`display-${code}`);
        socket.join(code);
        socket.roomCode = code;
        socket.playerIdx = 0;

        socket.emit('roomCreated', { code, playerIdx: 0 });
        broadcastRoom(code);
    });

    // DISPLAY joins (laptop/host view)
    socket.on('joinDisplay', ({ code }) => {
        const room = getRoom(code.toUpperCase());
        if (!room) { socket.emit('error', { msg: 'Room not found' }); return; }
        socket.join(`display-${code.toUpperCase()}`);
        socket.emit('gameState', getDisplayState(room));
    });

    // PLAYER joins
    socket.on('joinRoom', ({ code, playerName }) => {
        const upperCode = code.toUpperCase();
        const room = getRoom(upperCode);
        if (!room) { socket.emit('error', { msg: 'Room not found' }); return; }
        if (room.phase !== 'lobby') { socket.emit('error', { msg: 'Game already started' }); return; }
        if (room.players.length >= room.settings.maxPlayers) { socket.emit('error', { msg: 'Room is full' }); return; }

        const idx = room.players.length;
        room.players.push({ name: playerName || `Player ${idx + 1}`, socketId: socket.id });

        socket.join(upperCode);
        socket.roomCode = upperCode;
        socket.playerIdx = idx;

        socket.emit('joinedRoom', { code: upperCode, playerIdx: idx });
        broadcastRoom(upperCode);
    });

    // Rejoin (reconnect)
    socket.on('rejoin', ({ code, playerIdx }) => {
        const room = getRoom(code);
        if (!room || playerIdx >= room.players.length) return;
        room.players[playerIdx].socketId = socket.id;
        socket.join(code);
        socket.roomCode = code;
        socket.playerIdx = playerIdx;
        broadcastRoom(code);
    });

    // START GAME
    socket.on('startGame', () => {
        const room = getRoom(socket.roomCode);
        if (!room) return;
        if (socket.playerIdx !== 0) return; // only host can start

        if (room.game === 'uno') {
            if (room.players.length < 2) return;
            startUnoGame(room);
        } else if (room.game === 'battleships') {
            if (room.players.length !== 2) return;
            startBattleshipsGame(room);
        } else if (room.game === 'guesswho') {
            if (room.players.length !== 2) return;
            startGuessWhoGame(room);
        }
        broadcastRoom(room.code);
    });

    // === UNO ACTIONS ===
    socket.on('unoPlay', ({ cardIdx, chosenColor }) => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'uno' || room.phase !== 'playing') return;
        if (unoPlayCard(room, socket.playerIdx, cardIdx, chosenColor)) {
            broadcastRoom(room.code);
        }
    });

    socket.on('unoDraw', () => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'uno' || room.phase !== 'playing') return;
        if (unoDrawCard(room, socket.playerIdx)) {
            broadcastRoom(room.code);
        }
    });

    // === BATTLESHIPS ACTIONS ===
    socket.on('bsPlace', ({ shipName, cells }) => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'battleships' || room.phase !== 'placement') return;
        if (bsPlaceShip(room, socket.playerIdx, shipName, cells)) {
            broadcastRoom(room.code);
        }
    });

    socket.on('bsFire', ({ row, col }) => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'battleships' || room.phase !== 'playing') return;
        if (bsFire(room, socket.playerIdx, row, col)) {
            broadcastRoom(room.code);
        }
    });

    // === GUESS WHO ACTIONS ===
    socket.on('gwEliminate', ({ eliminated }) => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'guesswho') return;
        gwEliminate(room, socket.playerIdx, eliminated);
        broadcastRoom(room.code);
    });

    socket.on('gwGuess', ({ charName }) => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'guesswho' || room.phase !== 'playing') return;
        if (room.currentPlayer !== socket.playerIdx) return;
        gwGuess(room, socket.playerIdx, charName);
        broadcastRoom(room.code);
    });

    socket.on('gwEndTurn', () => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'guesswho' || room.phase !== 'playing') return;
        if (gwEndTurn(room, socket.playerIdx)) {
            broadcastRoom(room.code);
        }
    });

    // === RESTART ===
    socket.on('restart', () => {
        const room = getRoom(socket.roomCode);
        if (!room || socket.playerIdx !== 0) return;
        room.phase = 'lobby';
        broadcastRoom(room.code);
    });

    // DISCONNECT
    socket.on('disconnect', () => {
        if (!socket.roomCode) return;
        const room = getRoom(socket.roomCode);
        if (!room) return;
        const player = room.players[socket.playerIdx];
        if (player) player.socketId = null;
        broadcastRoom(socket.roomCode);
    });
});

const PORT = process.env.PORT || 3000;

// External URL is just the host itself when deployed
app.get('/api/server-info', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const joinUrl = `${protocol}://${host}/join.html`;
    res.json({ joinUrl });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  🎮 Game Arcade Server running on port ${PORT}\n`);
});
