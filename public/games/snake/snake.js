// ===== SNAKE - Premium Edition =====

class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 20;
        this.tileCount = 22;
        this.canvas.width = this.tileCount * this.gridSize;
        this.canvas.height = this.tileCount * this.gridSize;

        this.score = 0;
        this.best = parseInt(localStorage.getItem('snake-best') || '0');
        this.running = false;
        this.gameOver = false;
        this.speed = 120;
        this.lastTime = 0;
        this.accumulator = 0;

        this.snake = [];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.food = { x: 0, y: 0 };
        this.particles = [];

        this.elScore = document.getElementById('score');
        this.elBest = document.getElementById('best');
        this.elOverlay = document.getElementById('start-overlay');

        this.elBest.textContent = this.best;

        this.bindEvents();
        this.reset();
        this.draw();
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.start();
                return;
            }
            this.setDirection(e.key);
        });

        this.elOverlay.addEventListener('click', () => this.start());

        // Mobile controls
        document.getElementById('ctrl-up').addEventListener('click', () => { this.setDirection('ArrowUp'); this.start(); });
        document.getElementById('ctrl-down').addEventListener('click', () => { this.setDirection('ArrowDown'); this.start(); });
        document.getElementById('ctrl-left').addEventListener('click', () => { this.setDirection('ArrowLeft'); this.start(); });
        document.getElementById('ctrl-right').addEventListener('click', () => { this.setDirection('ArrowRight'); this.start(); });

        // Swipe
        let sx, sy;
        this.canvas.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; });
        this.canvas.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - sx;
            const dy = e.changedTouches[0].clientY - sy;
            if (Math.abs(dx) > Math.abs(dy)) {
                this.setDirection(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
            } else {
                this.setDirection(dy > 0 ? 'ArrowDown' : 'ArrowUp');
            }
            this.start();
        });
    }

    setDirection(key) {
        const map = {
            'ArrowUp': { x: 0, y: -1 },
            'ArrowDown': { x: 0, y: 1 },
            'ArrowLeft': { x: -1, y: 0 },
            'ArrowRight': { x: 1, y: 0 },
            'w': { x: 0, y: -1 }, 'W': { x: 0, y: -1 },
            's': { x: 0, y: 1 }, 'S': { x: 0, y: 1 },
            'a': { x: -1, y: 0 }, 'A': { x: -1, y: 0 },
            'd': { x: 1, y: 0 }, 'D': { x: 1, y: 0 },
        };
        const dir = map[key];
        if (!dir) return;
        // Prevent reversing
        if (dir.x === -this.direction.x && dir.y === -this.direction.y) return;
        this.nextDirection = dir;
    }

    start() {
        if (this.running) return;
        if (this.gameOver) this.reset();
        this.running = true;
        this.elOverlay.classList.add('hidden');
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    reset() {
        const mid = Math.floor(this.tileCount / 2);
        this.snake = [
            { x: mid, y: mid },
            { x: mid - 1, y: mid },
            { x: mid - 2, y: mid }
        ];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.score = 0;
        this.gameOver = false;
        this.speed = 120;
        this.particles = [];
        this.elScore.textContent = '0';
        this.placeFood();
    }

    placeFood() {
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * this.tileCount),
                y: Math.floor(Math.random() * this.tileCount)
            };
        } while (this.snake.some(s => s.x === pos.x && s.y === pos.y));
        this.food = pos;
    }

    loop(time) {
        if (!this.running) return;

        const delta = time - this.lastTime;
        this.lastTime = time;
        this.accumulator += delta;

        while (this.accumulator >= this.speed) {
            this.update();
            this.accumulator -= this.speed;
            if (!this.running) return;
        }

        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    update() {
        this.direction = { ...this.nextDirection };

        const head = {
            x: this.snake[0].x + this.direction.x,
            y: this.snake[0].y + this.direction.y
        };

        // Wall collision
        if (head.x < 0 || head.x >= this.tileCount || head.y < 0 || head.y >= this.tileCount) {
            this.die();
            return;
        }

        // Self collision
        if (this.snake.some(s => s.x === head.x && s.y === head.y)) {
            this.die();
            return;
        }

        this.snake.unshift(head);

        // Eat food
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score++;
            this.elScore.textContent = this.score;
            this.speed = Math.max(50, 120 - this.score * 2);
            this.spawnParticles(this.food.x, this.food.y);
            this.placeFood();
        } else {
            this.snake.pop();
        }

        // Update particles
        this.particles = this.particles.filter(p => p.life > 0);
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.03;
        });
    }

    spawnParticles(x, y) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: (x + 0.5) * this.gridSize,
                y: (y + 0.5) * this.gridSize,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1
            });
        }
    }

    die() {
        this.running = false;
        this.gameOver = true;
        if (this.score > this.best) {
            this.best = this.score;
            this.elBest.textContent = this.best;
            localStorage.setItem('snake-best', String(this.best));
        }
        this.elOverlay.classList.remove('hidden');
        this.elOverlay.querySelector('p').innerHTML = `Game Over! Score: <strong>${this.score}</strong><br>Tap or press Space to restart`;
    }

    draw() {
        const ctx = this.ctx;
        const gs = this.gridSize;

        // Background
        ctx.fillStyle = '#0f2744';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid lines (subtle)
        ctx.strokeStyle = 'rgba(79, 195, 247, 0.03)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= this.tileCount; i++) {
            ctx.beginPath();
            ctx.moveTo(i * gs, 0);
            ctx.lineTo(i * gs, this.canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * gs);
            ctx.lineTo(this.canvas.width, i * gs);
            ctx.stroke();
        }

        // Food glow
        const fx = (this.food.x + 0.5) * gs;
        const fy = (this.food.y + 0.5) * gs;
        const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, gs * 1.5);
        glow.addColorStop(0, 'rgba(231, 76, 60, 0.15)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(fx - gs * 1.5, fy - gs * 1.5, gs * 3, gs * 3);

        // Food
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(fx, fy, gs * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(fx - 2, fy - 2, gs * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Snake
        this.snake.forEach((seg, i) => {
            const t = i / this.snake.length;
            const r = Math.floor(46 - t * 20);
            const g = Math.floor(204 - t * 80);
            const b = Math.floor(113 - t * 40);
            ctx.fillStyle = `rgb(${r},${g},${b})`;

            const padding = 1;
            const radius = 4;
            const x = seg.x * gs + padding;
            const y = seg.y * gs + padding;
            const w = gs - padding * 2;
            const h = gs - padding * 2;

            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.fill();

            // Head eyes
            if (i === 0) {
                ctx.fillStyle = '#fff';
                const ex = seg.x * gs + gs * 0.5 + this.direction.x * 4;
                const ey = seg.y * gs + gs * 0.5 + this.direction.y * 4;
                ctx.beginPath();
                ctx.arc(ex - 3, ey - 3, 2.5, 0, Math.PI * 2);
                ctx.arc(ex + 3, ey - 3, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Particles
        this.particles.forEach(p => {
            ctx.fillStyle = `rgba(231, 76, 60, ${p.life})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

new SnakeGame();
