// ===== 2048 =====
class Game2048 {
    constructor() {
        this.size = 4;
        this.grid = [];
        this.score = 0;
        this.best = parseInt(localStorage.getItem('2048-best')) || 0;
        this.gameOver = false;
        this.won = false;
        this.moving = false;

        this.tileContainer = document.getElementById('tile-container');
        this.scoreEl = document.getElementById('score');
        this.bestEl = document.getElementById('best');
        this.overlay = document.getElementById('game-overlay');
        this.overlayMsg = document.getElementById('overlay-msg');

        document.getElementById('new-game-btn').addEventListener('click', () => this.init());
        document.getElementById('retry-btn').addEventListener('click', () => this.init());

        this.bindInput();
        this.init();
    }

    init() {
        this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(0));
        this.score = 0;
        this.gameOver = false;
        this.won = false;
        this.overlay.classList.add('hidden');
        this.addRandomTile();
        this.addRandomTile();
        this.render();
    }

    bindInput() {
        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (this.moving || this.gameOver) return;
            const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
            if (map[e.key]) {
                e.preventDefault();
                this.move(map[e.key]);
            }
        });

        // Touch/Swipe
        let startX, startY;
        const board = document.getElementById('board');
        board.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        board.addEventListener('touchend', (e) => {
            if (this.moving || this.gameOver) return;
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
        }, { passive: true });
    }

    addRandomTile() {
        const empty = [];
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.grid[r][c] === 0) empty.push([r, c]);
            }
        }
        if (empty.length === 0) return;
        const [r, c] = empty[Math.floor(Math.random() * empty.length)];
        this.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
    }

    move(direction) {
        this.moving = true;
        const prev = this.grid.map(row => [...row]);
        let moved = false;

        const rotated = this.rotateForDirection(direction);
        
        // Process each row left
        for (let r = 0; r < this.size; r++) {
            const row = rotated[r].filter(v => v !== 0);
            const merged = [];
            
            for (let i = 0; i < row.length; i++) {
                if (i + 1 < row.length && row[i] === row[i + 1]) {
                    const val = row[i] * 2;
                    merged.push(val);
                    this.score += val;
                    if (val === 2048 && !this.won) this.won = true;
                    i++;
                } else {
                    merged.push(row[i]);
                }
            }
            
            while (merged.length < this.size) merged.push(0);
            rotated[r] = merged;
        }

        this.grid = this.unrotateForDirection(rotated, direction);

        // Check if anything moved
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.grid[r][c] !== prev[r][c]) moved = true;
            }
        }

        if (moved) {
            this.addRandomTile();
            if (this.score > this.best) {
                this.best = this.score;
                localStorage.setItem('2048-best', this.best);
            }
        }

        this.render();

        if (!this.hasMovesLeft()) {
            this.gameOver = true;
            setTimeout(() => this.showOverlay('Game Over!'), 300);
        } else if (this.won) {
            this.won = false; // Allow continuing
        }

        setTimeout(() => { this.moving = false; }, 150);
    }

    rotateForDirection(dir) {
        const g = this.grid;
        switch (dir) {
            case 'left': return g.map(row => [...row]);
            case 'right': return g.map(row => [...row].reverse());
            case 'up': return this.transpose(g);
            case 'down': return this.transpose(g).map(row => [...row].reverse());
        }
    }

    unrotateForDirection(rotated, dir) {
        switch (dir) {
            case 'left': return rotated;
            case 'right': return rotated.map(row => [...row].reverse());
            case 'up': return this.transpose(rotated);
            case 'down': return this.transpose(rotated.map(row => [...row].reverse()));
        }
    }

    transpose(grid) {
        return grid[0].map((_, c) => grid.map(row => row[c]));
    }

    hasMovesLeft() {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.grid[r][c] === 0) return true;
                if (c + 1 < this.size && this.grid[r][c] === this.grid[r][c + 1]) return true;
                if (r + 1 < this.size && this.grid[r][c] === this.grid[r + 1][c]) return true;
            }
        }
        return false;
    }

    showOverlay(msg) {
        this.overlayMsg.textContent = msg;
        this.overlay.classList.remove('hidden');
    }

    render() {
        this.scoreEl.textContent = this.score;
        this.bestEl.textContent = this.best;

        this.tileContainer.innerHTML = '';
        const gap = 10;
        const cellSize = (this.tileContainer.offsetWidth - gap * 3) / 4;

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const val = this.grid[r][c];
                if (val === 0) continue;

                const tile = document.createElement('div');
                const cls = val <= 2048 ? `tile-${val}` : 'tile-super';
                tile.className = `tile ${cls}`;
                tile.textContent = val;

                const left = c * (cellSize + gap);
                const top = r * (cellSize + gap);
                tile.style.left = left + 'px';
                tile.style.top = top + 'px';
                tile.style.width = cellSize + 'px';
                tile.style.height = cellSize + 'px';

                this.tileContainer.appendChild(tile);
            }
        }
    }
}

// Start
new Game2048();
