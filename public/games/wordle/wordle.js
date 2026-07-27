// ===== WORDLE =====
const WORDS = [
    'crane','slate','trace','audio','stare','arise','raise','learn','resin','stern',
    'senor','snare','irate','later','alter','heart','earth','trade','adore','drone',
    'cider','liner','miner','diner','timer','rider','viper','tiger','fiber','liver',
    'river','giver','power','tower','lower','mower','cover','lover','hover','rover',
    'super','outer','utter','enter','inter','under','upper','after','water','other',
    'table','fable','cable','maple','apple','ample','angle','ankle','cycle','style',
    'smile','while','spine','shine','whine','crime','prime','tribe','slide','guide',
    'pride','bride','prize','drive','alive','olive','movie','prove','stove','shove',
    'above','glove','solve','valve','nerve','serve','curve','nurse','purse','horse',
    'force','forge','gorge','surge','large','barge','badge','ledge','hedge','judge',
    'chunk','drunk','trunk','skunk','plank','blank','crank','frank','thank','think',
    'drink','blink','brink','stink','cling','bring','swing','thing','sting','using',
    'being','doing','going','human','woman','begin','cabin','basin','satin','latin',
    'robin','toxin','reign','grain','brain','train','plain','chain','claim','chair',
    'stair','flair','snail','trail','grail','email','royal','loyal','moral','coral',
    'metal','petal','total','vital','final','trial','rival','tidal','modal','local',
    'vocal','focal','regal','legal','naval','basal','nasal','cabal','papal','fatal',
    'piano','radio','ratio','patio','motto','photo','hippo','tempo','depot','lemon',
    'melon','bison','baron','mason','bacon','radon','demon','heron','felon','penal',
    'renal','venal','pecan','ocean','organ','urban','clash','flash','crash','brash'
];

const VALID_WORDS = new Set(WORDS); // In production you'd have a much larger valid word list
let answer, guesses, currentGuess, currentRow, gameOver, keyStates;

function newGame() {
    answer = WORDS[Math.floor(Math.random() * WORDS.length)];
    guesses = [];
    currentGuess = '';
    currentRow = 0;
    gameOver = false;
    keyStates = {};
    renderBoard();
    renderKeyboard();
}

function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    for (let r = 0; r < 6; r++) {
        const row = document.createElement('div');
        row.className = 'row';
        for (let c = 0; c < 5; c++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.id = `tile-${r}-${c}`;
            if (r < guesses.length) {
                tile.textContent = guesses[r][c].letter;
                tile.classList.add(guesses[r][c].state);
            } else if (r === currentRow && c < currentGuess.length) {
                tile.textContent = currentGuess[c];
                tile.classList.add('filled');
            }
            row.appendChild(tile);
        }
        board.appendChild(row);
    }
}

function renderKeyboard() {
    const rows = [
        ['q','w','e','r','t','y','u','i','o','p'],
        ['a','s','d','f','g','h','j','k','l'],
        ['enter','z','x','c','v','b','n','m','⌫']
    ];
    const kb = document.getElementById('keyboard');
    kb.innerHTML = '';
    rows.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'kb-row';
        row.forEach(key => {
            const btn = document.createElement('button');
            btn.className = 'key' + (key.length > 1 ? ' wide' : '');
            if (keyStates[key]) btn.classList.add(keyStates[key]);
            btn.textContent = key;
            btn.addEventListener('click', () => handleKey(key));
            rowEl.appendChild(btn);
        });
        kb.appendChild(rowEl);
    });
}

function handleKey(key) {
    if (gameOver) return;
    if (key === '⌫') {
        currentGuess = currentGuess.slice(0, -1);
        renderBoard();
        return;
    }
    if (key === 'enter') {
        submitGuess();
        return;
    }
    if (currentGuess.length >= 5) return;
    currentGuess += key;
    renderBoard();
}

function submitGuess() {
    if (currentGuess.length !== 5) {
        showMessage('Not enough letters');
        shakeRow();
        return;
    }
    // In a full game you'd validate against a dictionary
    // For now we accept any 5-letter combo

    const result = evaluateGuess(currentGuess, answer);
    guesses.push(result);

    // Update key states
    result.forEach(({ letter, state }) => {
        const current = keyStates[letter];
        if (state === 'correct') keyStates[letter] = 'correct';
        else if (state === 'present' && current !== 'correct') keyStates[letter] = 'present';
        else if (state === 'absent' && !current) keyStates[letter] = 'absent';
    });

    currentGuess = '';
    currentRow++;
    renderBoard();
    renderKeyboard();

    // Check win/lose
    if (result.every(r => r.state === 'correct')) {
        gameOver = true;
        showMessage('Brilliant! 🎉');
        setTimeout(() => { if(confirm('You won! Play again?')) newGame(); }, 2000);
    } else if (currentRow >= 6) {
        gameOver = true;
        showMessage(`The word was: ${answer.toUpperCase()}`);
        setTimeout(() => { if(confirm(`Game over! The word was ${answer.toUpperCase()}. Play again?`)) newGame(); }, 2500);
    }
}

function evaluateGuess(guess, target) {
    const result = [];
    const targetArr = target.split('');
    const used = Array(5).fill(false);

    // First pass: correct positions
    for (let i = 0; i < 5; i++) {
        if (guess[i] === target[i]) {
            result[i] = { letter: guess[i], state: 'correct' };
            used[i] = true;
        }
    }
    // Second pass: present/absent
    for (let i = 0; i < 5; i++) {
        if (result[i]) continue;
        const idx = targetArr.findIndex((c, j) => c === guess[i] && !used[j]);
        if (idx !== -1) {
            result[i] = { letter: guess[i], state: 'present' };
            used[idx] = true;
        } else {
            result[i] = { letter: guess[i], state: 'absent' };
        }
    }
    return result;
}

function shakeRow() {
    const tiles = document.querySelectorAll(`#tile-${currentRow}-0, #tile-${currentRow}-1, #tile-${currentRow}-2, #tile-${currentRow}-3, #tile-${currentRow}-4`);
    // Actually shake the whole row
    const row = document.querySelectorAll('.row')[currentRow];
    if (row) { row.querySelectorAll('.tile').forEach(t => { t.classList.add('shake'); setTimeout(()=>t.classList.remove('shake'),300); }); }
}

function showMessage(msg) {
    const el = document.getElementById('message');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = '';
    setTimeout(() => el.classList.add('hidden'), 2000);
}

// Keyboard input
document.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleKey('enter');
    else if (e.key === 'Backspace') handleKey('⌫');
    else if (/^[a-z]$/.test(e.key)) handleKey(e.key);
});

newGame();
