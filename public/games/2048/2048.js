// ===== 2048 - Premium Edition =====

class Game2048 {
    constructor() {
        this.size = 4;
        this.grid = [];
        this.score = 0;
        this.best = parseInt(localStorage.getItem('2048-best') || '0');
        this.gameOver = false;
        this.won = false;

        this.initDOM();
        this.bindEvents();
        this.newGame();
    }

    initDOM() {
        this.el = {
            board: document.getElementById('board'),
            tiles: document.getElementById('tiles'),
            score: document.getElementById('score'),
            best: document.getElementById('best'),
            overlay: document.getElementById('overlay'),
            overlayTitle: document.getElementById('overlay-title'),
            overlayScore: document.getElementById('overlay-score'),
            newGameBtn: document.getElementById('new-game-btn'),
            retryBtn: document.getElementById('retry-btn')
        };

        // Create background cells
        const gridBg = this.el.board.querySelector('.grid-bg');
        gridBg.innerHTML = '';
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell-bg';
                cell.style.top = `${r * (this.getCellSize() + this.getGap())}px`;
                cell.style.left = `${c * (this.getCellSize() + this.getGap())}px`;
                gridBg.appendChild(cell);
            }
        }

        this.el.best.textContent = this.best;
    }

    getCellSize() {
        const style = getComputedStyle(document.documentElement);
        return parseInt(style.getPropertyValue('--cell-size'));
    }

    getGap() {
        const style = getComputedStyle(document.documentElement);
        return parseInt(style.getPropertyValue('--gap'));
    }

    bindEvents() {
        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
                this.move(dir[e.key]);
            }
        });

        // Touch/Swipe
        let startX, startY;
        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        document.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;
            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if (Math.max(absDx, absDy) < 30) return;

            if (absDx > absDy) {
                this.move(dx > 0 ? 'right' : 'left');
            } else {
                this.move(dy > 0 ? 'down' : 'up');
            }
            startX = null;
            startY = null;
        });

        this.el.newGameBtn.addEventListener('click', () => this.newGame());
        this.el.retryBtn.addEventListener('click', () => {
            this.el.overlay.classList.add('hidden');
            this.newGame();
        });
    }

    // ===== GAME LOGIC =====
    newGame() {
        this.grid = Array.from({ length: 4 }, () => Array(4).fill(0));
        this.score = 0;
        this.gameOver = false;
        this.won = false;
        this.el.overlay.classList.add('hidden');
        this.el.score.textContent = '0';
        this.addRandomTile();
        this.addRandomTile();
        this.render();
    }

    addRandomTile() {
        const empty = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (this.grid[r][c] === 0) empty.push({ r, c });
            }
        }
        if (empty.length === 0) return;
        const { r, c } = empty[Math.floor(Math.random() * empty.length)];
        this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
        return { r, c };
    }

    move(direction) {
        if (this.gameOver) return;

        const prev = this.grid.map(row => [...row]);
        let merged = Array.from({ length: 4 }, () => Array(4).fill(false));

        const moveRC = (r, c, dr, dc) => {
            if (this.grid[r][c] === 0) return;
            let nr = r + dr;
            let nc = c + dc;
            while (nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && this.grid[nr][nc] === 0) {
                nr += dr;
                nc += dc;
            }
            // Check merge
            if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4 &&
                this.grid[nr][nc] === this.grid[r][c] && !merged[nr][nc]) {
                this.grid[nr][nc] *= 2;
                this.score += this.grid[nr][nc];
                this.grid[r][c] = 0;
                merged[nr][nc] = true;
            } else {
                // Move to last empty
                nr -= dr;
                nc -= dc;
                if (nr !== r || nc !== c) {
                    this.grid[nr][nc] = this.grid[r][c];
                    this.grid[r][c] = 0;
                }
            }
        };

        if (direction === 'up') {
            for (let c = 0; c < 4; c++)
                for (let r = 1; r < 4; r++) moveRC(r, c, -1, 0);
        } else if (direction === 'down') {
            for (let c = 0; c < 4; c++)
                for (let r = 2; r >= 0; r--) moveRC(r, c, 1, 0);
        } else if (direction === 'left') {
            for (let r = 0; r < 4; r++)
                for (let c = 1; c < 4; c++) moveRC(r, c, 0, -1);
        } else if (direction === 'right') {
            for (let r = 0; r < 4; r++)
                for (let c = 2; c >= 0; c--) moveRC(r, c, 0, 1);
        }

        // Check if board changed
        let changed = false;
        for (let r = 0; r < 4; r++)
            for (let c = 0; c < 4; c++)
                if (this.grid[r][c] !== prev[r][c]) changed = true;

        if (!changed) return;

        // Update score
        this.el.score.textContent = this.score;
        if (this.score > this.best) {
            this.best = this.score;
            this.el.best.textContent = this.best;
            localStorage.setItem('2048-best', String(this.best));
        }

        // Add new tile
        const newTile = this.addRandomTile();
        this.render(merged, newTile);

        // Check game over
        if (!this.canMove()) {
            this.gameOver = true;
            setTimeout(() => {
                this.el.overlayTitle.textContent = 'Game Over';
                this.el.overlayScore.textContent = `Score: ${this.score}`;
                this.el.overlay.classList.remove('hidden');
            }, 300);
        }

        // Check 2048
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (this.grid[r][c] === 2048 && !this.won) {
                    this.won = true;
                    setTimeout(() => {
                        this.el.overlayTitle.textContent = '🎉 You reached 2048!';
                        this.el.overlayScore.textContent = `Score: ${this.score} — Keep going?`;
                        this.el.overlay.classList.remove('hidden');
                    }, 300);
                }
            }
        }
    }

    canMove() {
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (this.grid[r][c] === 0) return true;
                if (c < 3 && this.grid[r][c] === this.grid[r][c + 1]) return true;
                if (r < 3 && this.grid[r][c] === this.grid[r + 1][c]) return true;
            }
        }
        return false;
    }

    // ===== RENDERING =====
    render(merged, newTile) {
        const cellSize = this.getCellSize();
        const gap = this.getGap();

        this.el.tiles.innerHTML = '';

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const val = this.grid[r][c];
                if (val === 0) continue;

                const tile = document.createElement('div');
                tile.className = `tile tile-${val}`;
                tile.textContent = val;
                tile.style.top = `${r * (cellSize + gap)}px`;
                tile.style.left = `${c * (cellSize + gap)}px`;

                if (newTile && newTile.r === r && newTile.c === c) {
                    tile.classList.add('new');
                }
                if (merged && merged[r][c]) {
                    tile.classList.add('merged');
                }

                this.el.tiles.appendChild(tile);
            }
        }
    }
}

// Initialize
new Game2048();
