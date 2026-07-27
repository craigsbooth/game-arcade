// ===== SINGLE PLAYER BLACKJACK =====
const SUITS = ['♠','♥','♦','♣'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

let deck, playerHand, dealerHand, chips, bet, gamePhase;
// gamePhase: betting, playing, dealer, result

const elChips = document.getElementById('chips');
const elBet = document.getElementById('current-bet');
const elMsg = document.getElementById('message');
const elPlayerCards = document.getElementById('player-cards');
const elDealerCards = document.getElementById('dealer-cards');
const elPlayerScore = document.getElementById('player-score');
const elDealerScore = document.getElementById('dealer-score');
const betControls = document.getElementById('bet-controls');
const playControls = document.getElementById('play-controls');
const resultControls = document.getElementById('result-controls');
const dealBtn = document.getElementById('deal-btn');

chips = parseInt(localStorage.getItem('bj-chips') || '1000');
elChips.textContent = chips;

function createDeck() {
    const d = [];
    for (let i=0;i<6;i++) // 6-deck shoe
        SUITS.forEach(s => VALUES.forEach(v => d.push({suit:s, value:v})));
    // Shuffle
    for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
    return d;
}

function handScore(hand) {
    let total=0, aces=0;
    hand.forEach(c => {
        if(c.value==='A'){aces++;total+=11;}
        else if(['J','Q','K'].includes(c.value)) total+=10;
        else total+=parseInt(c.value);
    });
    while(total>21&&aces>0){total-=10;aces--;}
    return total;
}

function isBlackjack(hand) { return hand.length===2 && handScore(hand)===21; }

function cardHTML(card, facedown) {
    if(facedown) return `<div class="card facedown"></div>`;
    const red = card.suit==='♥'||card.suit==='♦';
    return `<div class="card ${red?'red':'black'}">
        <div class="card-tl">${card.value}${card.suit}</div>
        <div class="card-center">${card.suit}</div>
        <div class="card-br">${card.value}${card.suit}</div>
    </div>`;
}

function render() {
    elPlayerCards.innerHTML = playerHand.map(c=>cardHTML(c,false)).join('');
    if(gamePhase==='playing') {
        elDealerCards.innerHTML = cardHTML(dealerHand[0],false) + cardHTML(dealerHand[1],true);
        elDealerScore.textContent = '';
    } else {
        elDealerCards.innerHTML = dealerHand.map(c=>cardHTML(c,false)).join('');
        elDealerScore.textContent = handScore(dealerHand);
    }
    elPlayerScore.textContent = handScore(playerHand);
    elChips.textContent = chips;
}

// Betting
bet = 0;
document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const amt = parseInt(btn.dataset.bet);
        if(amt > chips) return;
        bet += amt;
        elBet.textContent = bet;
        dealBtn.disabled = bet===0;
    });
});

function newHand() {
    bet=0; elBet.textContent='0'; dealBtn.disabled=true;
    gamePhase='betting';
    betControls.classList.remove('hidden');
    playControls.classList.add('hidden');
    resultControls.classList.add('hidden');
    elMsg.textContent='';
    elPlayerCards.innerHTML=''; elDealerCards.innerHTML='';
    elPlayerScore.textContent=''; elDealerScore.textContent='';
    if(chips<=0) { chips=1000; localStorage.setItem('bj-chips','1000'); elChips.textContent=chips; elMsg.textContent='Bankrupt! Chips reset to 1000'; }
}

dealBtn.addEventListener('click', deal);
document.getElementById('hit-btn').addEventListener('click', hit);
document.getElementById('stand-btn').addEventListener('click', stand);
document.getElementById('double-btn').addEventListener('click', doubleDown);
document.getElementById('again-btn').addEventListener('click', newHand);

function deal() {
    if(bet===0||bet>chips) return;
    chips -= bet;
    localStorage.setItem('bj-chips', String(chips));
    deck = createDeck();
    playerHand = [deck.pop(), deck.pop()];
    dealerHand = [deck.pop(), deck.pop()];
    gamePhase = 'playing';
    betControls.classList.add('hidden');
    playControls.classList.remove('hidden');
    // Enable double only if chips allow
    document.getElementById('double-btn').disabled = chips < bet;
    render();

    // Check for blackjack
    if(isBlackjack(playerHand)) {
        if(isBlackjack(dealerHand)) { endRound('push'); }
        else { endRound('blackjack'); }
    } else if(isBlackjack(dealerHand)) {
        endRound('dealer-bj');
    }
}

function hit() {
    playerHand.push(deck.pop());
    render();
    if(handScore(playerHand)>21) endRound('bust');
}

function stand() {
    dealerPlay();
}

function doubleDown() {
    if(chips<bet) return;
    chips -= bet;
    bet *= 2;
    localStorage.setItem('bj-chips', String(chips));
    playerHand.push(deck.pop());
    render();
    if(handScore(playerHand)>21) { endRound('bust'); return; }
    dealerPlay();
}

function dealerPlay() {
    gamePhase = 'dealer';
    playControls.classList.add('hidden');
    render();
    // Dealer draws to 17
    function dealerDraw() {
        if(handScore(dealerHand)<17) {
            dealerHand.push(deck.pop());
            render();
            setTimeout(dealerDraw, 500);
        } else {
            resolve();
        }
    }
    setTimeout(dealerDraw, 400);
}

function resolve() {
    const ps = handScore(playerHand);
    const ds = handScore(dealerHand);
    if(ds>21) endRound('dealer-bust');
    else if(ps>ds) endRound('win');
    else if(ps===ds) endRound('push');
    else endRound('lose');
}

function endRound(result) {
    gamePhase='result';
    playControls.classList.add('hidden');
    resultControls.classList.remove('hidden');
    // Show dealer cards
    elDealerCards.innerHTML = dealerHand.map(c=>cardHTML(c,false)).join('');
    elDealerScore.textContent = handScore(dealerHand);

    let winnings = 0;
    switch(result) {
        case 'blackjack': winnings=Math.floor(bet*2.5); elMsg.textContent='BLACKJACK! 🎉'; break;
        case 'win': winnings=bet*2; elMsg.textContent='YOU WIN! 🏆'; break;
        case 'dealer-bust': winnings=bet*2; elMsg.textContent='DEALER BUSTS! You win!'; break;
        case 'push': winnings=bet; elMsg.textContent='PUSH — Bet returned'; break;
        case 'bust': winnings=0; elMsg.textContent='BUST! 💥'; break;
        case 'lose': winnings=0; elMsg.textContent='Dealer wins'; break;
        case 'dealer-bj': winnings=0; elMsg.textContent='Dealer Blackjack!'; break;
    }
    chips += winnings;
    localStorage.setItem('bj-chips', String(chips));
    elChips.textContent = chips;

    // High score = max chips
    const maxChips = parseInt(localStorage.getItem('bj-max-chips')||'1000');
    if(chips > maxChips) {
        localStorage.setItem('bj-max-chips', String(chips));
        showHighScores('blackjack-solo', chips);
    }
}

newHand();
