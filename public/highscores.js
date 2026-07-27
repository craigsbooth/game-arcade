// ===== SHARED HIGH SCORES COMPONENT =====
// Include this in any game. Call: showHighScores(gameId, playerScore)

(function() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        #hs-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:9999; display:flex; align-items:center; justify-content:center; font-family:'JetBrains Mono','Courier New',monospace; }
        #hs-overlay.hidden { display:none; }
        .hs-container { width:340px; padding:24px 28px; border:2px solid #22c55e; border-radius:4px; background:#0a0a0a; box-shadow:0 0 30px rgba(34,197,94,0.15),inset 0 0 60px rgba(34,197,94,0.03); }
        .hs-title { text-align:center; font-size:18px; color:#22c55e; letter-spacing:4px; margin-bottom:16px; text-shadow:0 0 8px rgba(34,197,94,0.5); }
        .hs-table { width:100%; border-collapse:collapse; }
        .hs-table tr { border-bottom:1px solid rgba(34,197,94,0.1); }
        .hs-table td { padding:6px 4px; font-size:13px; color:#22c55e; }
        .hs-table .hs-rank { width:30px; color:rgba(34,197,94,0.5); }
        .hs-table .hs-name { text-transform:uppercase; letter-spacing:2px; }
        .hs-table .hs-score { text-align:right; font-weight:700; }
        .hs-table .hs-you { color:#fbbf24; text-shadow:0 0 6px rgba(251,191,36,0.4); }
        .hs-input-row { display:flex; gap:8px; margin-top:16px; align-items:center; justify-content:center; }
        .hs-input-row input { width:60px; background:#111; border:1px solid #22c55e; color:#22c55e; font-family:inherit; font-size:16px; padding:6px 8px; text-align:center; text-transform:uppercase; letter-spacing:3px; border-radius:2px; outline:none; }
        .hs-input-row input:focus { box-shadow:0 0 8px rgba(34,197,94,0.3); }
        .hs-input-row button { background:#22c55e; color:#0a0a0a; border:none; padding:6px 14px; font-family:inherit; font-weight:700; font-size:13px; cursor:pointer; border-radius:2px; }
        .hs-input-row button:hover { background:#4ade80; }
        .hs-close { display:block; text-align:center; margin-top:14px; color:rgba(34,197,94,0.4); font-size:11px; cursor:pointer; letter-spacing:1px; }
        .hs-close:hover { color:#22c55e; }
        .hs-empty { text-align:center; color:rgba(34,197,94,0.3); font-size:12px; padding:20px 0; }
        .hs-new-label { text-align:center; color:#fbbf24; font-size:12px; margin-bottom:8px; letter-spacing:1px; }
    `;
    document.head.appendChild(style);

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'hs-overlay';
    overlay.className = 'hidden';
    document.body.appendChild(overlay);

    // Public API
    window.showHighScores = async function(gameId, playerScore) {
        const scores = await fetch(`/api/highscores/${gameId}`).then(r=>r.json()).catch(()=>[]);
        const qualifies = scores.length < 10 || (playerScore !== undefined && playerScore > (scores[scores.length-1]?.score || 0));
        const isNewHigh = playerScore !== undefined && qualifies;

        let html = `<div class="hs-container">`;
        html += `<div class="hs-title">HIGH SCORES</div>`;

        if (isNewHigh) {
            html += `<div class="hs-new-label">★ NEW HIGH SCORE: ${playerScore.toLocaleString()} ★</div>`;
            html += `<div class="hs-input-row">
                <input id="hs-name-input" maxlength="3" placeholder="AAA" autocomplete="off">
                <button id="hs-submit-btn">SAVE</button>
            </div>`;
        }

        if (scores.length > 0) {
            html += `<table class="hs-table">`;
            scores.forEach((s, i) => {
                html += `<tr><td class="hs-rank">${i+1}.</td><td class="hs-name">${s.name}</td><td class="hs-score">${s.score.toLocaleString()}</td></tr>`;
            });
            html += `</table>`;
        } else {
            html += `<div class="hs-empty">NO SCORES YET</div>`;
        }

        html += `<div class="hs-close" id="hs-close">[ CLOSE ]</div>`;
        html += `</div>`;

        overlay.innerHTML = html;
        overlay.classList.remove('hidden');

        // Events
        document.getElementById('hs-close').addEventListener('click', () => overlay.classList.add('hidden'));
        overlay.addEventListener('click', (e) => { if(e.target===overlay) overlay.classList.add('hidden'); });

        if (isNewHigh) {
            const input = document.getElementById('hs-name-input');
            const btn = document.getElementById('hs-submit-btn');
            input.focus();
            const submit = async () => {
                const name = input.value.trim() || 'AAA';
                const updated = await fetch(`/api/highscores/${gameId}`, {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ name, score: playerScore })
                }).then(r=>r.json()).catch(()=>[]);
                // Re-render with updated scores
                window.showHighScores(gameId);
            };
            btn.addEventListener('click', submit);
            input.addEventListener('keydown', e => { if(e.key==='Enter') submit(); });
        }
    };

    window.checkHighScore = async function(gameId, playerScore) {
        const scores = await fetch(`/api/highscores/${gameId}`).then(r=>r.json()).catch(()=>[]);
        return scores.length < 10 || playerScore > (scores[scores.length-1]?.score || 0);
    };
})();
