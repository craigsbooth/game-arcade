const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ===== ERROR LOGGING =====
const fs = require('fs');
const logFile = path.join(__dirname, 'error.log');

app.post('/api/log-error', express.json(), (req, res) => {
    const { game, error, stack, userAgent, timestamp } = req.body || {};
    const entry = `[${timestamp || new Date().toISOString()}] [${game || 'unknown'}] ${error}\n  Stack: ${stack || 'none'}\n  UA: ${userAgent || 'unknown'}\n\n`;
    fs.appendFileSync(logFile, entry);
    console.error(`CLIENT ERROR [${game}]:`, error);
    res.json({ ok: true });
});

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
    } else if (room.game === 'trivia' && room.trivia) {
        Object.assign(base, getTriviaDisplayState(room));
    } else if (room.game === 'blackjack' && room.blackjack) {
        base.dealer = room.blackjack.phase === 'playing' ? [room.blackjack.dealer[0], null] : room.blackjack.dealer;
        base.dealerScore = room.blackjack.phase === 'playing' ? '?' : cardScore(room.blackjack.dealer);
        base.bjPhase = room.blackjack.phase;
        base.bjCurrentPlayer = room.blackjack.currentPlayer;
        base.playerHands = room.players.map(p => ({ hand: p.bjHand, score: cardScore(p.bjHand || []), busted: p.bjBusted, stood: p.bjStood, chips: p.bjChips }));
        base.results = room.blackjack.results;
    } else if (room.game === 'liarsdice' && room.liarsdice) {
        base.ldPhase = room.liarsdice.phase;
        base.currentBid = room.liarsdice.currentBid;
        base.playerDice = room.players.map(p => ({ alive: p.ldAlive, diceCount: p.ldDiceCount, dice: room.liarsdice.phase === 'reveal' || room.liarsdice.phase === 'finished' ? p.ldDice : null }));
        base.roundResults = room.liarsdice.roundResults;
        base.ldWinner = room.liarsdice.winner;
    } else if (room.game === 'connect4' && room.c4) {
        base.c4Board = room.c4.board;
        base.c4Winner = room.c4.winner;
        base.c4WinCells = room.c4.winCells;
        base.c4LastMove = room.c4.lastMove;
    } else if (room.game === 'checkers' && room.checkers) {
        base.ckBoard = room.checkers.board;
        base.ckWinner = room.checkers.winner;
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
    } else if (room.game === 'trivia' && room.trivia) {
        Object.assign(base, getTriviaPlayerState(room, playerIdx));
    } else if (room.game === 'blackjack' && room.blackjack) {
        base.myHand = room.players[playerIdx].bjHand;
        base.myScore = cardScore(room.players[playerIdx].bjHand || []);
        base.myChips = room.players[playerIdx].bjChips;
        base.myBusted = room.players[playerIdx].bjBusted;
        base.myStood = room.players[playerIdx].bjStood;
        base.bjPhase = room.blackjack.phase;
        base.bjCurrentPlayer = room.blackjack.currentPlayer;
        base.isMyBjTurn = room.blackjack.currentPlayer === playerIdx;
        base.dealer = room.blackjack.phase === 'playing' ? [room.blackjack.dealer[0], null] : room.blackjack.dealer;
        base.dealerScore = room.blackjack.phase === 'playing' ? '?' : cardScore(room.blackjack.dealer);
        base.results = room.blackjack.results;
    } else if (room.game === 'liarsdice' && room.liarsdice) {
        base.myDice = room.players[playerIdx].ldDice;
        base.myAlive = room.players[playerIdx].ldAlive;
        base.myDiceCount = room.players[playerIdx].ldDiceCount;
        base.ldPhase = room.liarsdice.phase;
        base.currentBid = room.liarsdice.currentBid;
        base.isMyLdTurn = room.currentPlayer === playerIdx;
        base.playerDice = room.players.map(p => ({ alive: p.ldAlive, diceCount: p.ldDiceCount }));
        base.roundResults = room.liarsdice.roundResults;
        base.ldWinner = room.liarsdice.winner;
    } else if (room.game === 'connect4' && room.c4) {
        base.c4Board = room.c4.board;
        base.c4Winner = room.c4.winner;
        base.c4WinCells = room.c4.winCells;
        base.isMyC4Turn = room.currentPlayer === playerIdx;
        base.myColor = playerIdx;
    } else if (room.game === 'checkers' && room.checkers) {
        base.ckBoard = room.checkers.board;
        base.ckWinner = room.checkers.winner;
        base.isMyTurn = room.currentPlayer === playerIdx;
        base.myPieces = playerIdx === 0 ? [1,3] : [2,4];
        base.mustJump = room.checkers.mustJump;
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

// ===== TRIVIA LOGIC =====
const TRIVIA_QUESTIONS = [
    { q: "What planet is known as the Red Planet?", answers: ["Mars", "Venus", "Jupiter", "Saturn"], correct: 0, category: "Science" },
    { q: "Who painted the Mona Lisa?", answers: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"], correct: 1, category: "Art" },
    { q: "What is the capital of Japan?", answers: ["Seoul", "Beijing", "Tokyo", "Bangkok"], correct: 2, category: "Geography" },
    { q: "Which element has the chemical symbol 'O'?", answers: ["Gold", "Oxygen", "Osmium", "Oganesson"], correct: 1, category: "Science" },
    { q: "In what year did the Titanic sink?", answers: ["1905", "1912", "1918", "1923"], correct: 1, category: "History" },
    { q: "What is the largest ocean on Earth?", answers: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: 3, category: "Geography" },
    { q: "Who wrote 'Romeo and Juliet'?", answers: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], correct: 1, category: "Literature" },
    { q: "What is the speed of light approximately?", answers: ["300,000 km/s", "150,000 km/s", "500,000 km/s", "1,000,000 km/s"], correct: 0, category: "Science" },
    { q: "Which country hosted the 2016 Olympics?", answers: ["China", "UK", "Brazil", "Russia"], correct: 2, category: "Sports" },
    { q: "What is the smallest prime number?", answers: ["0", "1", "2", "3"], correct: 2, category: "Math" },
    { q: "Which band sang 'Bohemian Rhapsody'?", answers: ["The Beatles", "Queen", "Led Zeppelin", "Pink Floyd"], correct: 1, category: "Music" },
    { q: "What is the hardest natural substance?", answers: ["Gold", "Iron", "Diamond", "Platinum"], correct: 2, category: "Science" },
    { q: "Who was the first person to walk on the Moon?", answers: ["Buzz Aldrin", "Neil Armstrong", "Yuri Gagarin", "John Glenn"], correct: 1, category: "History" },
    { q: "What language has the most native speakers?", answers: ["English", "Spanish", "Hindi", "Mandarin Chinese"], correct: 3, category: "Language" },
    { q: "Which planet has the most moons?", answers: ["Jupiter", "Saturn", "Uranus", "Neptune"], correct: 1, category: "Science" },
    { q: "What year was the iPhone first released?", answers: ["2005", "2006", "2007", "2008"], correct: 2, category: "Technology" },
    { q: "Who directed Jurassic Park?", answers: ["James Cameron", "Steven Spielberg", "George Lucas", "Ridley Scott"], correct: 1, category: "Film" },
    { q: "What is the largest continent by area?", answers: ["Africa", "North America", "Europe", "Asia"], correct: 3, category: "Geography" },
    { q: "How many bones are in the adult human body?", answers: ["186", "206", "226", "246"], correct: 1, category: "Science" },
    { q: "Which country invented pizza?", answers: ["France", "Greece", "Italy", "Spain"], correct: 2, category: "Food" },
    { q: "What is the chemical formula for water?", answers: ["CO2", "H2O", "NaCl", "O2"], correct: 1, category: "Science" },
    { q: "Who painted 'Starry Night'?", answers: ["Monet", "Picasso", "Van Gogh", "Rembrandt"], correct: 2, category: "Art" },
    { q: "What is the longest river in the world?", answers: ["Amazon", "Nile", "Mississippi", "Yangtze"], correct: 1, category: "Geography" },
    { q: "In which year did World War II end?", answers: ["1943", "1944", "1945", "1946"], correct: 2, category: "History" },
    { q: "What does 'HTTP' stand for?", answers: ["HyperText Transfer Protocol", "High Tech Transfer Protocol", "HyperText Transmission Program", "Home Tool Transfer Protocol"], correct: 0, category: "Technology" }
];

function startTriviaGame(room) {
    const questions = shuffle([...TRIVIA_QUESTIONS]).slice(0, 10);
    room.trivia = {
        questions,
        currentQuestion: 0,
        scores: room.players.map(() => 0),
        answers: room.players.map(() => null),
        phase: 'question', // question, results, final
        timer: null,
        winner: null
    };
    room.phase = 'playing';
}

function triviaAnswer(room, playerIdx, answerIdx) {
    if (room.trivia.phase !== 'question') return false;
    if (room.trivia.answers[playerIdx] !== null) return false;
    room.trivia.answers[playerIdx] = answerIdx;

    // Check if all answered
    const allAnswered = room.trivia.answers.every(a => a !== null);
    if (allAnswered) {
        triviaShowResults(room);
    }
    return true;
}

function triviaShowResults(room) {
    room.trivia.phase = 'results';
    const q = room.trivia.questions[room.trivia.currentQuestion];
    room.trivia.answers.forEach((ans, i) => {
        if (ans === q.correct) {
            room.trivia.scores[i] += 100;
        }
    });
}

function triviaNextQuestion(room) {
    room.trivia.currentQuestion++;
    if (room.trivia.currentQuestion >= room.trivia.questions.length) {
        // Game over
        room.trivia.phase = 'final';
        room.phase = 'finished';
        const maxScore = Math.max(...room.trivia.scores);
        room.trivia.winner = room.trivia.scores.indexOf(maxScore);
    } else {
        room.trivia.phase = 'question';
        room.trivia.answers = room.players.map(() => null);
    }
}

function getTriviaDisplayState(room) {
    const t = room.trivia;
    const base = {
        currentQuestion: t.currentQuestion,
        totalQuestions: t.questions.length,
        scores: t.scores,
        phase: t.phase,
        winner: t.winner,
        answeredCount: t.answers.filter(a => a !== null).length,
        totalPlayers: room.players.length
    };
    if (t.phase === 'question') {
        const q = t.questions[t.currentQuestion];
        base.question = q.q;
        base.category = q.category;
        base.answers = q.answers;
    }
    if (t.phase === 'results' || t.phase === 'final') {
        const q = t.questions[t.currentQuestion < t.questions.length ? t.currentQuestion : t.currentQuestion - 1];
        base.question = q.q;
        base.answers = q.answers;
        base.correct = q.correct;
        base.playerAnswers = t.answers;
    }
    return base;
}

function getTriviaPlayerState(room, playerIdx) {
    const t = room.trivia;
    const base = {
        currentQuestion: t.currentQuestion,
        totalQuestions: t.questions.length,
        myScore: t.scores[playerIdx],
        phase: t.phase,
        myAnswer: t.answers[playerIdx],
        winner: t.winner
    };
    if (t.phase === 'question') {
        const q = t.questions[t.currentQuestion];
        base.question = q.q;
        base.category = q.category;
        base.answers = q.answers;
    }
    if (t.phase === 'results') {
        const q = t.questions[t.currentQuestion];
        base.correct = q.correct;
    }
    return base;
}

// ===== BLACKJACK LOGIC =====
function createBlackjackDeck() {
    const suits = ['♠','♥','♦','♣'];
    const values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const deck = [];
    for (let d = 0; d < 6; d++) { // 6-deck shoe
        suits.forEach(s => values.forEach(v => deck.push({ suit: s, value: v })));
    }
    return shuffle(deck);
}

function cardScore(hand) {
    let total = 0;
    let aces = 0;
    hand.forEach(c => {
        if (c.value === 'A') { aces++; total += 11; }
        else if (['J','Q','K'].includes(c.value)) { total += 10; }
        else { total += parseInt(c.value); }
    });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
}

function startBlackjackGame(room) {
    room.blackjack = {
        deck: createBlackjackDeck(),
        dealer: [],
        phase: 'betting', // betting, playing, dealer, results
        currentPlayer: 0,
        results: null
    };
    room.players.forEach(p => {
        p.bjHand = [];
        p.bjBet = 100;
        p.bjChips = p.bjChips || 1000;
        p.bjStood = false;
        p.bjBusted = false;
    });
    room.phase = 'playing';
    // Deal
    bjDeal(room);
}

function bjDeal(room) {
    const bj = room.blackjack;
    // Deal 2 cards to each player and dealer
    room.players.forEach(p => {
        p.bjHand = [bj.deck.pop(), bj.deck.pop()];
        p.bjStood = false;
        p.bjBusted = false;
    });
    bj.dealer = [bj.deck.pop(), bj.deck.pop()];
    bj.phase = 'playing';
    bj.currentPlayer = 0;
}

function bjHit(room, playerIdx) {
    if (room.blackjack.phase !== 'playing') return false;
    if (room.blackjack.currentPlayer !== playerIdx) return false;
    const p = room.players[playerIdx];
    if (p.bjStood || p.bjBusted) return false;

    p.bjHand.push(room.blackjack.deck.pop());
    if (cardScore(p.bjHand) > 21) {
        p.bjBusted = true;
        bjAdvancePlayer(room);
    }
    return true;
}

function bjStand(room, playerIdx) {
    if (room.blackjack.phase !== 'playing') return false;
    if (room.blackjack.currentPlayer !== playerIdx) return false;
    room.players[playerIdx].bjStood = true;
    bjAdvancePlayer(room);
    return true;
}

function bjAdvancePlayer(room) {
    const bj = room.blackjack;
    bj.currentPlayer++;
    if (bj.currentPlayer >= room.players.length) {
        // Dealer's turn
        bjDealerPlay(room);
    }
}

function bjDealerPlay(room) {
    const bj = room.blackjack;
    bj.phase = 'dealer';
    // Dealer hits until 17
    while (cardScore(bj.dealer) < 17) {
        bj.dealer.push(bj.deck.pop());
    }
    bjResolve(room);
}

function bjResolve(room) {
    const bj = room.blackjack;
    bj.phase = 'results';
    room.phase = 'finished';
    const dealerScore = cardScore(bj.dealer);
    const dealerBust = dealerScore > 21;

    bj.results = room.players.map((p, i) => {
        const pScore = cardScore(p.bjHand);
        if (p.bjBusted) return { result: 'bust', delta: -p.bjBet };
        if (dealerBust) return { result: 'win', delta: p.bjBet };
        if (pScore > dealerScore) return { result: 'win', delta: p.bjBet };
        if (pScore === dealerScore) return { result: 'push', delta: 0 };
        return { result: 'lose', delta: -p.bjBet };
    });

    // Apply chips
    bj.results.forEach((r, i) => {
        room.players[i].bjChips += r.delta;
    });
}

// ===== LIAR'S DICE LOGIC =====
function startLiarsDice(room) {
    room.liarsdice = {
        dicePerPlayer: 5,
        currentBid: null, // { quantity, face }
        phase: 'rolling', // rolling, bidding, reveal, finished
        roundResults: null,
        winner: null
    };
    room.players.forEach(p => {
        p.ldDice = [];
        p.ldAlive = true;
        p.ldDiceCount = 5;
    });
    room.currentPlayer = 0;
    room.phase = 'playing';
    ldRoll(room);
}

function ldRoll(room) {
    room.players.forEach(p => {
        if (!p.ldAlive) return;
        p.ldDice = [];
        for (let i = 0; i < p.ldDiceCount; i++) {
            p.ldDice.push(Math.floor(Math.random() * 6) + 1);
        }
    });
    room.liarsdice.currentBid = null;
    room.liarsdice.phase = 'bidding';
}

function ldBid(room, playerIdx, quantity, face) {
    if (room.liarsdice.phase !== 'bidding') return false;
    if (room.currentPlayer !== playerIdx) return false;
    if (face < 1 || face > 6) return false;
    if (quantity < 1) return false;

    const prev = room.liarsdice.currentBid;
    if (prev) {
        // Must be higher: more quantity, or same quantity but higher face
        if (quantity < prev.quantity) return false;
        if (quantity === prev.quantity && face <= prev.face) return false;
    }

    room.liarsdice.currentBid = { quantity, face, player: playerIdx };
    ldNextPlayer(room);
    return true;
}

function ldChallenge(room, playerIdx) {
    if (room.liarsdice.phase !== 'bidding') return false;
    if (room.currentPlayer !== playerIdx) return false;
    if (!room.liarsdice.currentBid) return false;

    const bid = room.liarsdice.currentBid;

    // Count all dice with that face (1s are wild unless bidding 1s)
    let count = 0;
    room.players.forEach(p => {
        if (!p.ldAlive) return;
        p.ldDice.forEach(d => {
            if (d === bid.face) count++;
            else if (d === 1 && bid.face !== 1) count++; // 1s are wild
        });
    });

    const bidderIdx = bid.player;
    room.liarsdice.phase = 'reveal';

    if (count >= bid.quantity) {
        // Bid was correct, challenger loses a die
        room.players[playerIdx].ldDiceCount--;
        room.liarsdice.roundResults = {
            challenger: playerIdx,
            bidder: bidderIdx,
            bid,
            actualCount: count,
            loser: playerIdx
        };
    } else {
        // Bid was wrong, bidder loses a die
        room.players[bidderIdx].ldDiceCount--;
        room.liarsdice.roundResults = {
            challenger: playerIdx,
            bidder: bidderIdx,
            bid,
            actualCount: count,
            loser: bidderIdx
        };
    }

    // Check elimination
    room.players.forEach(p => {
        if (p.ldDiceCount <= 0) p.ldAlive = false;
    });

    // Check winner
    const alive = room.players.filter(p => p.ldAlive);
    if (alive.length === 1) {
        room.liarsdice.winner = room.players.indexOf(alive[0]);
        room.liarsdice.phase = 'finished';
        room.phase = 'finished';
    }

    return true;
}

function ldNextRound(room) {
    if (room.liarsdice.phase === 'finished') return;
    // Loser starts next round
    const loserIdx = room.liarsdice.roundResults.loser;
    room.currentPlayer = loserIdx;
    // If loser is eliminated, go next
    while (!room.players[room.currentPlayer].ldAlive) {
        room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
    }
    ldRoll(room);
}

function ldNextPlayer(room) {
    do {
        room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
    } while (!room.players[room.currentPlayer].ldAlive);
}

// ===== CONNECT FOUR LOGIC =====
function startConnectFour(room) {
    room.c4 = {
        board: Array.from({length:6}, () => Array(7).fill(null)), // 6 rows x 7 cols
        winner: null,
        winCells: null,
        lastMove: null
    };
    room.currentPlayer = 0;
    room.phase = 'playing';
}

function c4Drop(room, playerIdx, col) {
    if (room.currentPlayer !== playerIdx) return false;
    if (col < 0 || col > 6) return false;
    const board = room.c4.board;
    // Find lowest empty row in column
    let row = -1;
    for (let r = 5; r >= 0; r--) {
        if (board[r][col] === null) { row = r; break; }
    }
    if (row === -1) return false; // column full

    board[row][col] = playerIdx;
    room.c4.lastMove = { row, col, player: playerIdx };

    // Check win
    const win = c4CheckWin(board, row, col, playerIdx);
    if (win) {
        room.c4.winner = playerIdx;
        room.c4.winCells = win;
        room.phase = 'finished';
    } else if (board[0].every(c => c !== null)) {
        // Draw
        room.c4.winner = -1;
        room.phase = 'finished';
    } else {
        room.currentPlayer = 1 - playerIdx;
    }
    return true;
}

function c4CheckWin(board, row, col, player) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr,dc] of dirs) {
        let cells = [[row,col]];
        for (let d=1; d<4; d++) {
            const r=row+dr*d, c=col+dc*d;
            if (r>=0&&r<6&&c>=0&&c<7&&board[r][c]===player) cells.push([r,c]);
            else break;
        }
        for (let d=1; d<4; d++) {
            const r=row-dr*d, c=col-dc*d;
            if (r>=0&&r<6&&c>=0&&c<7&&board[r][c]===player) cells.push([r,c]);
            else break;
        }
        if (cells.length >= 4) return cells.slice(0,4);
    }
    return null;
}

// ===== CHECKERS LOGIC =====
function startCheckers(room) {
    // Board: 0=empty, 1=p1, 2=p2, 3=p1king, 4=p2king
    const board = Array.from({length:8}, () => Array(8).fill(0));
    // Place pieces
    for (let r=0; r<3; r++) for (let c=0; c<8; c++) { if ((r+c)%2===1) board[r][c]=2; }
    for (let r=5; r<8; r++) for (let c=0; c<8; c++) { if ((r+c)%2===1) board[r][c]=1; }
    room.checkers = { board, winner: null, mustJump: null };
    room.currentPlayer = 0;
    room.phase = 'playing';
}

function checkersMove(room, playerIdx, from, to) {
    if (room.currentPlayer !== playerIdx) return false;
    const board = room.checkers.board;
    const [fr, fc] = from;
    const [tr, tc] = to;
    const piece = board[fr][fc];
    const pNum = playerIdx + 1; // 1 or 2
    if (piece !== pNum && piece !== pNum + 2) return false; // not your piece
    if (board[tr][tc] !== 0) return false;
    if ((tr+tc)%2 !== 1) return false; // must be dark square

    const isKing = piece >= 3;
    const dr = tr - fr, dc = tc - fc;

    // Simple move
    if (Math.abs(dr)===1 && Math.abs(dc)===1) {
        if (!isKing && pNum===1 && dr>0) return false; // p1 moves up (decreasing row)
        if (!isKing && pNum===2 && dr<0) return false;
        if (room.checkers.mustJump) return false; // must jump if available
        board[tr][tc] = piece; board[fr][fc] = 0;
        promoteIfNeeded(board, tr, tc, pNum);
        room.currentPlayer = 1 - playerIdx;
        room.checkers.mustJump = null;
    }
    // Jump
    else if (Math.abs(dr)===2 && Math.abs(dc)===2) {
        const mr = fr+dr/2, mc = fc+dc/2;
        const mid = board[mr][mc];
        const enemy = playerIdx===0 ? [2,4] : [1,3];
        if (!enemy.includes(mid)) return false;
        if (!isKing && pNum===1 && dr>0) return false;
        if (!isKing && pNum===2 && dr<0) return false;
        board[tr][tc] = piece; board[fr][fc] = 0; board[mr][mc] = 0;
        promoteIfNeeded(board, tr, tc, pNum);
        // Multi-jump?
        if (hasJump(board, tr, tc, pNum)) {
            room.checkers.mustJump = [tr, tc];
        } else {
            room.currentPlayer = 1 - playerIdx;
            room.checkers.mustJump = null;
        }
    } else { return false; }

    // Check win
    const enemyPieces = playerIdx===0 ? [2,4] : [1,3];
    const enemyCount = board.flat().filter(c => enemyPieces.includes(c)).length;
    if (enemyCount === 0) { room.checkers.winner = playerIdx; room.phase = 'finished'; }

    return true;
}

function promoteIfNeeded(board, r, c, pNum) {
    if (pNum===1 && r===0) board[r][c] = 3;
    if (pNum===2 && r===7) board[r][c] = 4;
}

function hasJump(board, r, c, pNum) {
    const piece = board[r][c];
    const isKing = piece >= 3;
    const dirs = isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] : (pNum===1 ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]]);
    const enemy = pNum===1 ? [2,4] : [1,3];
    return dirs.some(([dr,dc]) => {
        const mr=r+dr, mc=c+dc, tr=r+dr*2, tc=c+dc*2;
        return tr>=0&&tr<8&&tc>=0&&tc<8&&enemy.includes(board[mr][mc])&&board[tr][tc]===0;
    });
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
            players: [],
            currentPlayer: 0,
            settings: { maxPlayers: (game === 'uno' || game === 'trivia') ? 10 : (game === 'liarsdice' || game === 'blackjack') ? 6 : 2 },
            hostSocketId: socket.id
        };
        rooms.set(code, room);

        socket.join(`display-${code}`);
        socket.join(code);
        socket.roomCode = code;
        socket.isHost = true;

        socket.emit('roomCreated', { code });
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
        if (!socket.isHost) return; // only host display can start

        if (room.game === 'uno') {
            if (room.players.length < 2) return;
            startUnoGame(room);
        } else if (room.game === 'battleships') {
            if (room.players.length !== 2) return;
            startBattleshipsGame(room);
        } else if (room.game === 'guesswho') {
            if (room.players.length !== 2) return;
            startGuessWhoGame(room);
        } else if (room.game === 'trivia') {
            if (room.players.length < 2) return;
            startTriviaGame(room);
        } else if (room.game === 'blackjack') {
            if (room.players.length < 2) return;
            startBlackjackGame(room);
        } else if (room.game === 'liarsdice') {
            if (room.players.length < 2) return;
            startLiarsDice(room);
        } else if (room.game === 'connect4') {
            if (room.players.length !== 2) return;
            startConnectFour(room);
        } else if (room.game === 'checkers') {
            if (room.players.length !== 2) return;
            startCheckers(room);
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

    // === TRIVIA ACTIONS ===
    socket.on('triviaAnswer', ({ answerIdx }) => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'trivia' || room.phase !== 'playing') return;
        if (triviaAnswer(room, socket.playerIdx, answerIdx)) {
            broadcastRoom(room.code);
        }
    });

    socket.on('triviaNext', () => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'trivia') return;
        if (!socket.isHost) return;
        triviaNextQuestion(room);
        broadcastRoom(room.code);
    });

    // === BLACKJACK ACTIONS ===
    socket.on('bjHit', () => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'blackjack' || room.blackjack.phase !== 'playing') return;
        if (bjHit(room, socket.playerIdx)) {
            broadcastRoom(room.code);
        }
    });

    socket.on('bjStand', () => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'blackjack' || room.blackjack.phase !== 'playing') return;
        if (bjStand(room, socket.playerIdx)) {
            broadcastRoom(room.code);
        }
    });

    socket.on('bjNewRound', () => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'blackjack') return;
        if (!socket.isHost) return;
        bjDeal(room);
        room.phase = 'playing';
        broadcastRoom(room.code);
    });

    // === LIAR'S DICE ACTIONS ===
    socket.on('ldBid', ({ quantity, face }) => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'liarsdice') return;
        if (ldBid(room, socket.playerIdx, quantity, face)) {
            broadcastRoom(room.code);
        }
    });

    socket.on('ldChallenge', () => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'liarsdice') return;
        if (ldChallenge(room, socket.playerIdx)) {
            broadcastRoom(room.code);
        }
    });

    socket.on('ldNextRound', () => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'liarsdice') return;
        if (!socket.isHost) return;
        ldNextRound(room);
        broadcastRoom(room.code);
    });

    // === CONNECT FOUR ACTIONS ===
    socket.on('c4Drop', ({ col }) => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'connect4' || room.phase !== 'playing') return;
        if (c4Drop(room, socket.playerIdx, col)) broadcastRoom(room.code);
    });

    // === CHECKERS ACTIONS ===
    socket.on('checkersMove', ({ from, to }) => {
        const room = getRoom(socket.roomCode);
        if (!room || room.game !== 'checkers' || room.phase !== 'playing') return;
        if (checkersMove(room, socket.playerIdx, from, to)) broadcastRoom(room.code);
    });

    // === RESTART ===
    socket.on('restart', () => {
        const room = getRoom(socket.roomCode);
        if (!room) return;
        if (!socket.isHost) return;
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
