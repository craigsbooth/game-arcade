// ===== MINESWEEPER - Premium Edition =====

class Minesweeper {
    constructor() {
        this.rows = 9;
        this.cols = 9;
        this.totalMines = 10;
        this.grid = [];
        this.revealed = [];
        this.flagged = [];
        this.gameOver = false;
        this.gameWon = false;
        this.firstClick = true;
        this.timer = 0;
        this.timerInterval = null;
        this.flagCount = 0;

        this.initDOM();
        this.bindEvents();
        this.newGame();
    }

    initDOM() {
        this.el = {
            grid: document.getElementById('grid'),
            minesRemaining: document.getElementById('mines-remaining'),
            timerDisplay: document.getElementById('timer'),
            face: document.getElementById('face'),
            resetBtn: document.getElementById('reset-btn'),
            overlay: document.getElementById('overlay'),
            overlayIcon: document.getElementById('overlay-icon'),
            overlayTitle: document.getElementById('overlay-title'),
            overlaySubtitle: document.getElementById('overlay-subtitle'),
            overlayBtn: document.getElementById('overlay-btn')
        };
    }

    bindEvents() {
        this.el.resetBtn.addEventListener('click', () => this.newGame());
        this.el.overlayBtn.addEventListener('click', () => {
            this.el.overlay.classList.add('hidden');
            this.newGame();
        });

        // Difficulty buttons
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.rows = parseInt(btn.dataset.rows);
                this.cols = parseInt(btn.dataset.cols);
                this.totalMines = parseInt(btn.dataset.mines);
                this.newGame();
            });
        });

        // Prevent context menu on grid
        this.el.grid.addEventListener('contextmenu', e => e.preventDefault());
    }

    // ===== GAME SETUP =====
    newGame() {
        this.gameOver = false;
        this.gameWon = false;
        this.firstClick = true;
        this.flagCount = 0;
        this.timer = 0;
        this.stopTimer();

        this.el.face.textContent = '🙂';
        this.el.minesRemaining.textContent = this.totalMines;
        this.el.timerDisplay.textContent = '000';
        this.el.overlay.classList.add('hidden');

        // Initialize arrays
        this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
        this.revealed = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
        this.flagged = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));

        this.renderGrid();
    }

    placeMines(safeRow, safeCol) {
        // Place mines avoiding the first click and its neighbors
        let placed = 0;
        const safeCells = new Set();
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                safeCells.add(`${safeRow + dr},${safeCol + dc}`);
            }
        }

        while (placed < this.totalMines) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);
            if (this.grid[r][c] === -1) continue;
            if (safeCells.has(`${r},${c}`)) continue;
            this.grid[r][c] = -1;
            placed++;
        }

        // Calculate numbers
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] === -1) continue;
                let count = 0;
                this.forEachNeighbor(r, c, (nr, nc) => {
                    if (this.grid[nr][nc] === -1) count++;
                });
                this.grid[r][c] = count;
            }
        }
    }

    forEachNeighbor(row, col, callback) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                    callback(nr, nc);
                }
            }
        }
    }

    // ===== RENDERING =====
    renderGrid() {
        this.el.grid.innerHTML = '';
        this.el.grid.style.gridTemplateColumns = `repeat(${this.cols}, var(--cell-size))`;
        this.el.grid.style.gridTemplateRows = `repeat(${this.rows}, var(--cell-size))`;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell unrevealed';
                cell.dataset.row = r;
                cell.dataset.col = c;

                cell.addEventListener('click', () => this.handleClick(r, c));
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.handleRightClick(r, c);
                });
                // Long press for mobile flagging
                let pressTimer;
                cell.addEventListener('touchstart', (e) => {
                    pressTimer = setTimeout(() => {
                        e.preventDefault();
                        this.handleRightClick(r, c);
                    }, 400);
                });
                cell.addEventListener('touchend', () => clearTimeout(pressTimer));
                cell.addEventListener('touchmove', () => clearTimeout(pressTimer));

                this.el.grid.appendChild(cell);
            }
        }
    }

    getCell(row, col) {
        return this.el.grid.children[row * this.cols + col];
    }

    updateCell(row, col) {
        const cell = this.getCell(row, col);
        if (!cell) return;

        cell.className = 'cell';

        if (this.revealed[row][col]) {
            cell.classList.add('revealed');
            const val = this.grid[row][col];
            if (val === -1) {
                cell.textContent = '💣';
                cell.classList.add('mine-revealed');
            } else if (val > 0) {
                cell.textContent = val;
                cell.dataset.num = val;
            } else {
                cell.textContent = '';
            }
        } else if (this.flagged[row][col]) {
            cell.classList.add('unrevealed', 'flagged');
            cell.textContent = '';
        } else {
            cell.classList.add('unrevealed');
            cell.textContent = '';
        }
    }

    // ===== GAME LOGIC =====
    handleClick(row, col) {
        if (this.gameOver || this.gameWon) return;
        if (this.flagged[row][col]) return;
        if (this.revealed[row][col]) return;

        if (this.firstClick) {
            this.firstClick = false;
            this.placeMines(row, col);
            this.startTimer();
        }

        this.reveal(row, col);
    }

    handleRightClick(row, col) {
        if (this.gameOver || this.gameWon) return;
        if (this.revealed[row][col]) return;

        this.flagged[row][col] = !this.flagged[row][col];
        this.flagCount += this.flagged[row][col] ? 1 : -1;
        this.el.minesRemaining.textContent = this.totalMines - this.flagCount;
        this.updateCell(row, col);
    }

    reveal(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
        if (this.revealed[row][col] || this.flagged[row][col]) return;

        this.revealed[row][col] = true;
        this.updateCell(row, col);

        if (this.grid[row][col] === -1) {
            this.lose(row, col);
            return;
        }

        // Flood fill for empty cells
        if (this.grid[row][col] === 0) {
            this.forEachNeighbor(row, col, (nr, nc) => {
                this.reveal(nr, nc);
            });
        }

        this.checkWin();
    }

    checkWin() {
        let unrevealedSafe = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (!this.revealed[r][c] && this.grid[r][c] !== -1) {
                    unrevealedSafe++;
                }
            }
        }
        if (unrevealedSafe === 0) {
            this.win();
        }
    }

    win() {
        this.gameWon = true;
        this.stopTimer();
        this.el.face.textContent = '😎';

        // Flag all remaining mines
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] === -1 && !this.flagged[r][c]) {
                    this.flagged[r][c] = true;
                    this.updateCell(r, c);
                }
            }
        }

        setTimeout(() => {
            this.el.overlayIcon.textContent = '🏆';
            this.el.overlayTitle.textContent = 'You Win!';
            this.el.overlaySubtitle.textContent = `Cleared in ${this.timer} seconds`;
            this.el.overlay.classList.remove('hidden');
            // Score = cells revealed minus time (higher is better)
            const totalCells = this.rows * this.cols - this.totalMines;
            const hsScore = Math.max(1, totalCells * 100 - this.timer * 10);
            showHighScores('minesweeper', hsScore);
        }, 500);
    }

    lose(mineRow, mineCol) {
        this.gameOver = true;
        this.stopTimer();
        this.el.face.textContent = '😵';

        // Mark the exploded mine
        const explodedCell = this.getCell(mineRow, mineCol);
        explodedCell.className = 'cell mine-exploded';
        explodedCell.textContent = '💣';

        // Reveal all mines with staggered animation
        let delay = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] === -1 && !(r === mineRow && c === mineCol)) {
                    delay += 30;
                    setTimeout(() => {
                        this.revealed[r][c] = true;
                        this.updateCell(r, c);
                    }, delay);
                }
            }
        }

        setTimeout(() => {
            this.el.overlayIcon.textContent = '💥';
            this.el.overlayTitle.textContent = 'Game Over';
            this.el.overlaySubtitle.textContent = 'You hit a mine!';
            this.el.overlay.classList.remove('hidden');
        }, delay + 400);
    }

    // ===== TIMER =====
    startTimer() {
        this.timer = 0;
        this.timerInterval = setInterval(() => {
            this.timer++;
            this.el.timerDisplay.textContent = String(this.timer).padStart(3, '0');
            if (this.timer >= 999) this.stopTimer();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}

// Initialize
new Minesweeper();
