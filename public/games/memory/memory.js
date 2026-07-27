// ===== MEMORY MATCH =====
const EMOJIS = ['🚀','🎮','🎲','🎯','🏆','⚡','🔥','💎','🌟','🎪','🎨','🎭','🦊','🐸','🌈','🍕','🎵','🌺'];
let cards, flipped, matched, moves, locked;

function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}

function newGame() {
    const pairs = shuffle(EMOJIS).slice(0,18);
    cards = shuffle([...pairs,...pairs].map((emoji,i)=>({id:i,emoji,flipped:false,matched:false})));
    flipped=[]; matched=[]; moves=0; locked=false;
    document.getElementById('moves').textContent='0';
    document.getElementById('pairs').textContent='0';
    render();
}

function render() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    cards.forEach((card,i) => {
        const el = document.createElement('div');
        el.className = `card${card.flipped?' flipped':''}${card.matched?' matched':''}`;
        el.innerHTML = `<div class="card-inner"><div class="card-back">?</div><div class="card-front">${card.emoji}</div></div>`;
        el.addEventListener('click', () => flipCard(i));
        board.appendChild(el);
    });
}

function flipCard(i) {
    if(locked || cards[i].flipped || cards[i].matched) return;
    cards[i].flipped = true;
    flipped.push(i);
    render();

    if(flipped.length === 2) {
        moves++;
        document.getElementById('moves').textContent = moves;
        locked = true;
        const [a,b] = flipped;
        if(cards[a].emoji === cards[b].emoji) {
            cards[a].matched = true;
            cards[b].matched = true;
            matched.push(cards[a].emoji);
            document.getElementById('pairs').textContent = matched.length;
            flipped = [];
            locked = false;
            render();
            if(matched.length === 18) {
                // Score: fewer moves = higher score
                const hsScore = Math.max(1, 2000 - moves * 20);
                setTimeout(() => showHighScores('memory', hsScore), 500);
            }
        } else {
            setTimeout(() => {
                cards[a].flipped = false;
                cards[b].flipped = false;
                flipped = [];
                locked = false;
                render();
            }, 800);
        }
    }
}

newGame();
