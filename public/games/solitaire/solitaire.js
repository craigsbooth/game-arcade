// ===== SOLITAIRE (Klondike) - Premium Edition =====

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = { '♠': 'black', '♥': 'red', '♦': 'red', '♣': 'black' };
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

class Solitaire {
    constructor() {
        this.stock = [];
        this.waste = [];
        this.foundations = [[], [], [], []];
        this.tableau = [[], [], [], [], [], [], []];
        this.moves = 0;
        this.timer = 0;
        this.timerInterval = null;
        this.selected = null; // { pile, index }
        this.gameStarted = false;

        this.initDOM();
        this.bindEvents();
        this.newGame();
    }

    initDOM() {
        this.el = {
            stock: document.getElementById('stock'),
            waste: document.getElementById('waste'),
            foundations: document.querySelectorAll('.foundation'),
            tableauCols: document.querySelectorAll('.tableau-col'),
            moves: document.getElementById('moves'),
            timer: document.getElementById('timer'),
            newGameBtn: document.getElementById('new-game-btn'),
            winOverlay: document.getElementById('win-overlay'),
            winStats: document.getElementById('win-stats'),
            winNewGame: document.getElementById('win-new-game')
        };
    }

    bindEvents() {
        this.el.stock.addEventListener('click', () => this.drawFromStock());
        this.el.newGameBtn.addEventListener('click', () => this.newGame());
        this.el.winNewGame.addEventListener('click', () => {
            this.el.winOverlay.classList.add('hidden');
            this.newGame();
        });

        // Foundation clicks
        this.el.foundations.forEach((f, i) => {
            f.addEventListener('click', () => this.handleFoundationClick(i));
        });

        // Tableau clicks
        this.el.tableauCols.forEach((col, i) => {
            col.addEventListener('click', (e) => {
                const cardEl = e.target.closest('.card');
                if (cardEl) {
                    const cardIdx = parseInt(cardEl.dataset.index);
                    this.handleTableauClick(i, cardIdx);
                }
            });
        });

        // Waste click
        this.el.waste.addEventListener('click', (e) => {
            const cardEl = e.target.closest('.card');
            if (cardEl) this.handleWasteClick();
        });
    }

    // ===== GAME SETUP =====
    newGame() {
        this.stopTimer();
        this.moves = 0;
        this.timer = 0;
        this.gameStarted = false;
        this.selected = null;
        this.el.moves.textContent = '0';
        this.el.timer.textContent = '0:00';
        this.el.winOverlay.classList.add('hidden');

        // Create and shuffle deck
        let deck = [];
        SUITS.forEach(suit => {
            VALUES.forEach((val, i) => {
                deck.push({ suit, value: val, rank: i, faceUp: false });
            });
        });
        deck = this.shuffle(deck);

        // Deal tableau
        this.tableau = [[], [], [], [], [], [], []];
        for (let col = 0; col < 7; col++) {
            for (let row = 0; row <= col; row++) {
                const card = deck.pop();
                card.faceUp = (row === col);
                this.tableau[col].push(card);
            }
        }

        // Remaining cards go to stock
        this.stock = deck.map(c => { c.faceUp = false; return c; });
        this.waste = [];
        this.foundations = [[], [], [], []];

        this.render();
    }

    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    // ===== GAME LOGIC =====
    drawFromStock() {
        if (!this.gameStarted) this.startTimer();
        this.gameStarted = true;
        this.clearSelection();

        if (this.stock.length === 0) {
            // Reset stock from waste
            this.stock = this.waste.reverse().map(c => { c.faceUp = false; return c; });
            this.waste = [];
        } else {
            const card = this.stock.pop();
            card.faceUp = true;
            this.waste.push(card);
            this.moves++;
            this.el.moves.textContent = this.moves;
        }
        this.render();
    }

    handleWasteClick() {
        if (this.waste.length === 0) return;
        if (!this.gameStarted) this.startTimer();
        this.gameStarted = true;

        if (this.selected && this.selected.pile === 'waste') {
            this.clearSelection();
            this.render();
            return;
        }

        this.selected = { pile: 'waste', index: this.waste.length - 1 };
        this.render();
    }

    handleTableauClick(colIdx, cardIdx) {
        if (!this.gameStarted) this.startTimer();
        this.gameStarted = true;

        const col = this.tableau[colIdx];
        if (cardIdx >= col.length) return;
        const card = col[cardIdx];
        if (!card.faceUp) return;

        if (this.selected) {
            // Try to move selected to this column
            if (this.tryMove(colIdx)) return;
            this.clearSelection();
        }

        // Select this card (and all below it)
        this.selected = { pile: 'tableau', col: colIdx, index: cardIdx };
        this.render();
    }

    handleFoundationClick(fIdx) {
        if (!this.selected) return;
        this.tryMoveToFoundation(fIdx);
    }

    tryMove(targetCol) {
        const target = this.tableau[targetCol];
        let cards;

        if (this.selected.pile === 'waste') {
            cards = [this.waste[this.waste.length - 1]];
        } else if (this.selected.pile === 'tableau') {
            const srcCol = this.tableau[this.selected.col];
            cards = srcCol.slice(this.selected.index);
        } else {
            return false;
        }

        const movingCard = cards[0];
        const targetTop = target.length > 0 ? target[target.length - 1] : null;

        // Validate
        if (targetTop === null) {
            if (movingCard.value !== 'K') return false;
        } else {
            if (SUIT_COLORS[movingCard.suit] === SUIT_COLORS[targetTop.suit]) return false;
            if (movingCard.rank !== targetTop.rank - 1) return false;
        }

        // Execute move
        if (this.selected.pile === 'waste') {
            target.push(this.waste.pop());
        } else {
            const srcCol = this.tableau[this.selected.col];
            const moving = srcCol.splice(this.selected.index);
            target.push(...moving);
            // Flip new top card
            if (srcCol.length > 0 && !srcCol[srcCol.length - 1].faceUp) {
                srcCol[srcCol.length - 1].faceUp = true;
            }
        }

        this.moves++;
        this.el.moves.textContent = this.moves;
        this.clearSelection();
        this.render();
        this.checkWin();
        return true;
    }

    tryMoveToFoundation(fIdx) {
        let card;
        const foundation = this.foundations[fIdx];

        if (this.selected.pile === 'waste') {
            card = this.waste[this.waste.length - 1];
        } else if (this.selected.pile === 'tableau') {
            const col = this.tableau[this.selected.col];
            // Can only move single top card to foundation
            if (this.selected.index !== col.length - 1) { this.clearSelection(); this.render(); return; }
            card = col[col.length - 1];
        } else {
            return;
        }

        // Validate
        if (foundation.length === 0) {
            if (card.value !== 'A') { this.clearSelection(); this.render(); return; }
        } else {
            const top = foundation[foundation.length - 1];
            if (card.suit !== top.suit) { this.clearSelection(); this.render(); return; }
            if (card.rank !== top.rank + 1) { this.clearSelection(); this.render(); return; }
        }

        // Execute
        if (this.selected.pile === 'waste') {
            foundation.push(this.waste.pop());
        } else {
            const col = this.tableau[this.selected.col];
            foundation.push(col.pop());
            if (col.length > 0 && !col[col.length - 1].faceUp) {
                col[col.length - 1].faceUp = true;
            }
        }

        this.moves++;
        this.el.moves.textContent = this.moves;
        this.clearSelection();
        this.render();
        this.checkWin();
    }

    clearSelection() {
        this.selected = null;
    }

    checkWin() {
        const total = this.foundations.reduce((sum, f) => sum + f.length, 0);
        if (total === 52) {
            this.stopTimer();
            const mins = Math.floor(this.timer / 60);
            const secs = this.timer % 60;
            this.el.winStats.textContent = `${this.moves} moves in ${mins}:${String(secs).padStart(2, '0')}`;
            this.el.winOverlay.classList.remove('hidden');
        }
    }

    // ===== TIMER =====
    startTimer() {
        this.timer = 0;
        this.timerInterval = setInterval(() => {
            this.timer++;
            const mins = Math.floor(this.timer / 60);
            const secs = this.timer % 60;
            this.el.timer.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // ===== RENDERING =====
    render() {
        this.renderStock();
        this.renderWaste();
        this.renderFoundations();
        this.renderTableau();
    }

    createCardEl(card, index = 0) {
        const el = document.createElement('div');
        el.className = 'card';
        el.dataset.index = index;

        if (card.faceUp) {
            const colorClass = SUIT_COLORS[card.suit];
            el.innerHTML = `
                <div class="card-face ${colorClass}">
                    <div class="corner">${card.value}${card.suit}</div>
                    <div class="center-suit">${card.suit}</div>
                    <div class="corner corner-bottom">${card.value}${card.suit}</div>
                </div>
            `;
        } else {
            el.innerHTML = `<div class="card-back"></div>`;
        }
        return el;
    }

    renderStock() {
        this.el.stock.innerHTML = '';
        if (this.stock.length > 0) {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.style.top = '0';
            cardEl.style.left = '0';
            cardEl.innerHTML = `<div class="card-back"></div>`;
            this.el.stock.appendChild(cardEl);
        }
    }

    renderWaste() {
        this.el.waste.innerHTML = '';
        if (this.waste.length > 0) {
            const card = this.waste[this.waste.length - 1];
            const el = this.createCardEl(card, this.waste.length - 1);
            el.style.top = '0';
            el.style.left = '0';
            if (this.selected && this.selected.pile === 'waste') {
                el.classList.add('highlight');
            }
            this.el.waste.appendChild(el);
        }
    }

    renderFoundations() {
        this.el.foundations.forEach((fEl, i) => {
            fEl.innerHTML = '';
            const pile = this.foundations[i];
            if (pile.length > 0) {
                const card = pile[pile.length - 1];
                const el = this.createCardEl(card);
                el.style.top = '0';
                el.style.left = '0';
                fEl.appendChild(el);
            }
        });
    }

    renderTableau() {
        this.el.tableauCols.forEach((colEl, colIdx) => {
            colEl.innerHTML = '';
            const col = this.tableau[colIdx];
            col.forEach((card, cardIdx) => {
                const el = this.createCardEl(card, cardIdx);
                el.style.top = `${cardIdx * (card.faceUp ? 24 : 12)}px`;
                el.style.left = '0';
                el.style.zIndex = cardIdx;

                if (this.selected && this.selected.pile === 'tableau' &&
                    this.selected.col === colIdx && cardIdx >= this.selected.index) {
                    el.classList.add('highlight');
                }
                colEl.appendChild(el);
            });
        });
    }
}

// Initialize
new Solitaire();
