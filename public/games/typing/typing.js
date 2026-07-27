// ===== TYPING SPEED TEST =====
const SENTENCES = [
    "The quick brown fox jumps over the lazy dog near the riverbank",
    "Programming is the art of telling a computer what to do in detail",
    "A journey of a thousand miles begins with a single step forward",
    "Every great developer started as a beginner who refused to give up",
    "The best way to predict the future is to create it with your hands",
    "Practice makes perfect but nobody is perfect so why practice at all",
    "Life is what happens when you are busy making other plans for tomorrow",
    "In the middle of difficulty lies hidden opportunity waiting for you",
    "Success is not final failure is not fatal it is courage that counts",
    "The only way to do great work is to love what you do every single day",
    "Be yourself because everyone else is already taken in this big world",
    "Two things are infinite the universe and human stupidity I am not sure",
    "You miss every shot you do not take so keep shooting for the stars above",
    "The greatest glory in living lies not in never falling but in rising up",
    "It does not matter how slowly you go as long as you do not stop moving",
];

let text, typed, startTime, elapsed, timer, gameActive, totalChars, correctChars;
const input = document.getElementById('input');
const display = document.getElementById('text-display');

function newGame() {
    text = SENTENCES[Math.floor(Math.random()*SENTENCES.length)];
    typed = '';
    startTime = null;
    elapsed = 60;
    gameActive = false;
    totalChars = 0;
    correctChars = 0;
    input.value = '';
    input.disabled = false;
    input.focus();
    document.getElementById('result').style.display = 'none';
    document.getElementById('wpm').textContent = '0';
    document.getElementById('accuracy').textContent = '100%';
    document.getElementById('timer').textContent = '60s';
    if(timer) clearInterval(timer);
    renderText();
}

function renderText() {
    let html = '';
    for (let i=0; i<text.length; i++) {
        if (i < typed.length) {
            html += typed[i]===text[i] ?
                `<span class="correct">${text[i]}</span>` :
                `<span class="wrong">${text[i]}</span>`;
        } else if (i === typed.length) {
            html += `<span class="current">${text[i]}</span>`;
        } else {
            html += `<span class="pending">${text[i]}</span>`;
        }
    }
    display.innerHTML = html;
}

input.addEventListener('input', () => {
    if (!gameActive) { gameActive=true; startTime=Date.now(); startTimer(); }
    typed = input.value;
    totalChars++;
    // Count correct
    correctChars=0;
    for(let i=0;i<typed.length;i++) { if(typed[i]===text[i]) correctChars++; }
    renderText();
    updateStats();
    // Finished text
    if (typed.length >= text.length) {
        // Get new text
        text = SENTENCES[Math.floor(Math.random()*SENTENCES.length)];
        typed = '';
        input.value = '';
        renderText();
    }
});

function startTimer() {
    timer = setInterval(() => {
        const secs = Math.max(0, 60 - Math.floor((Date.now()-startTime)/1000));
        document.getElementById('timer').textContent = secs+'s';
        if (secs <= 0) endGame();
    }, 200);
}

function updateStats() {
    const mins = (Date.now()-startTime)/60000;
    if(mins<=0) return;
    const words = correctChars / 5;
    const wpm = Math.round(words / mins);
    const acc = totalChars>0 ? Math.round((correctChars/totalChars)*100) : 100;
    document.getElementById('wpm').textContent = wpm;
    document.getElementById('accuracy').textContent = acc+'%';
}

function endGame() {
    clearInterval(timer);
    gameActive=false;
    input.disabled=true;
    const mins = 1; // 60 second test
    const words = correctChars / 5;
    const wpm = Math.round(words / mins);
    const acc = totalChars>0 ? Math.round((correctChars/totalChars)*100) : 100;
    document.getElementById('result').style.display='block';
    document.getElementById('result-text').textContent=`${wpm} WPM with ${acc}% accuracy`;
    showHighScores('typing', wpm);
}

newGame();
