/**
 * Checkers AI Arena
 *
 * A checkers game with 7 AI algorithms, round-robin and bracket tournaments.
 * Code is split across three files:
 *   - sketch.js  (this file) - Core game, rendering, input
 *   - ai.js      - AI algorithms and board simulation
 *   - tournament.js - Tournament systems and visualization
 */

// ============================================
// Layout constants
// ============================================

const WIDTH = 1120;
const HEIGHT = 680;

const boardWidth = 400;
const boardHeight = 400;
const boardX = 60;
const boardY = 55;
const squareWidth = boardWidth / 8;
const squareHeight = boardHeight / 8;

const vizX = 520;
const vizY = 10;
const vizWidth = 570;
const vizHeight = 450;

// ============================================
// Game state
// ============================================

let playerTurn = 1;
let pieceSelected = null;

const player1Color = [70, 160, 80];
const player2Color = [230, 210, 60];

let player1 = null;
let player2 = null;
let game = null;
let gameOverWinner = null; // null or 1 or 2

// Repetition detection: board hash → occurrence count
let gameStateHistory = new Map();

function getBoardHash(board, turn) {
    const pieces = board.pieces
        .map(p => `${p.x}${p.y}${p.team}${p.king ? 1 : 0}`)
        .sort()
        .join(',');
    return pieces + ':' + turn;
}

function recordBoardState() {
    const hash = getBoardHash(game.board, playerTurn);
    gameStateHistory.set(hash, (gameStateHistory.get(hash) || 0) + 1);
}

function wouldRepeat(board, turn) {
    const hash = getBoardHash(board, turn);
    return (gameStateHistory.get(hash) || 0) >= 2;
}

// ============================================
// Core classes
// ============================================

class Piece {
    constructor(id, x, y, team) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.x0 = x;
        this.y0 = y;
        this.team = team;
        this.king = false;
    }

    draw() {
        let cx = boardX + this.x * squareWidth + squareWidth / 2;
        let cy = boardY + this.y * squareHeight + squareHeight / 2;
        let r = squareWidth * 0.38;

        push();
        noStroke();

        // Shadow
        fill(0, 0, 0, 50);
        ellipse(cx + 2, cy + 3, r * 2, r * 2);

        // Base
        const c = this.team === 1 ? player1Color : player2Color;
        fill(c[0], c[1], c[2]);
        ellipse(cx, cy, r * 2, r * 2);

        // Highlight
        fill(255, 255, 255, 50);
        ellipse(cx - r * 0.2, cy - r * 0.2, r * 1.4, r * 1.4);

        // Inner for 3D effect
        fill(c[0], c[1], c[2]);
        ellipse(cx, cy, r * 1.6, r * 1.6);

        // Inner ring
        stroke(255, 255, 255, 30);
        strokeWeight(1);
        noFill();
        ellipse(cx, cy, r * 1.3, r * 1.3);

        // King crown
        if (this.king) {
            noStroke();
            fill(255, 255, 255, 200);
            textAlign(CENTER, CENTER);
            textSize(18);
            textStyle(BOLD);
            text('\u265A', cx, cy + 1);
        }

        pop();
    }
}

class Board {
    constructor(pieces) {
        this.pieces = pieces;
    }

    draw() {
        drawBoard();
        for (let piece of this.pieces) piece.draw();
    }
}

class Game {
    constructor(board) {
        this.board = board;
    }

    draw() {
        if (this.board) this.board.draw();
    }
}

class Player {
    constructor(id, team) {
        this.id = id;
        this.team = team;
    }
}

// ============================================
// Board rendering
// ============================================

function drawBoard() {
    push();

    // Shadow
    noStroke();
    fill(0, 0, 0, 40);
    rect(boardX + 4, boardY + 4, boardWidth, boardHeight, 4);

    // Border
    fill(60, 45, 30);
    rect(boardX - 6, boardY - 6, boardWidth + 12, boardHeight + 12, 6);

    // Squares
    for (let i = 0; i < 8; i++) {
        let y = boardY + i * squareHeight;
        for (let j = 0; j < 8; j++) {
            let x = boardX + j * squareWidth;
            fill((i + j) % 2 === 0 ? [220, 210, 190] : [120, 90, 65]);
            noStroke();
            rect(x, y, squareWidth, squareHeight);
        }
    }

    // Labels
    textAlign(CENTER, CENTER);
    textSize(11);
    fill(160, 170, 180);
    const cols = 'abcdefgh';
    for (let i = 0; i < 8; i++) {
        text(cols[i], boardX + i * squareWidth + squareWidth / 2, boardY - 14);
        text(8 - i, boardX - 14, boardY + i * squareHeight + squareHeight / 2);
    }

    pop();
}

function teamHasCapture(team) {
    for (let p of game.board.pieces.filter(p => p.team === team)) {
        const saved = [p.x0, p.y0];
        p.x0 = p.x; p.y0 = p.y;
        const moves = findAvailableMoves(p);
        p.x0 = saved[0]; p.y0 = saved[1];
        if (moves.some(m => piceKilled(p, m[0], m[1]))) return true;
    }
    return false;
}

function drawAvailableMoves() {
    if (!pieceSelected) return;
    let moves = findAvailableMoves(pieceSelected);

    // Mandatory capture: only show captures if any exist for this team
    if (teamHasCapture(pieceSelected.team)) {
        moves = moves.filter(m => piceKilled(pieceSelected, m[0], m[1]));
    }

    for (let [x, y] of moves) {
        let cx = boardX + x * squareWidth + squareWidth / 2;
        let cy = boardY + y * squareHeight + squareHeight / 2;
        let pulse = 0.7 + 0.3 * sin(frameCount * 0.1);
        noStroke();
        fill(100, 220, 120, 120 * pulse);
        ellipse(cx, cy, squareWidth * 0.35, squareHeight * 0.35);
        fill(100, 220, 120, 60 * pulse);
        ellipse(cx, cy, squareWidth * 0.55, squareHeight * 0.55);
    }

    // Highlight selected piece
    let sx = boardX + pieceSelected.x0 * squareWidth;
    let sy = boardY + pieceSelected.y0 * squareHeight;
    noFill();
    stroke(100, 255, 130, 180);
    strokeWeight(2.5);
    rect(sx + 2, sy + 2, squareWidth - 4, squareHeight - 4, 3);
    noStroke();
}

function drawPlayerInfo() {
    push();
    const panelY = boardY - 42;
    const panelH = 36;
    const p1Label = AI_NAMES[player1Type] || 'Human';
    const p2Label = AI_NAMES[player2Type] || 'Human';

    textAlign(LEFT, CENTER);
    textSize(14);

    // Player 1
    const p1Active = playerTurn === 1;
    if (p1Active) {
        fill(player1Color[0], player1Color[1], player1Color[2], 30);
        noStroke();
        rect(boardX - 6, panelY, boardWidth / 2 + 3, panelH, 6, 0, 0, 6);
    }
    fill(p1Active ? 255 : 140);
    noStroke();
    ellipse(boardX + 14, panelY + panelH / 2, 16, 16);
    fill(player1Color[0], player1Color[1], player1Color[2]);
    ellipse(boardX + 14, panelY + panelH / 2, 12, 12);
    fill(p1Active ? 230 : 130, p1Active ? 240 : 140, p1Active ? 230 : 130);
    textStyle(p1Active ? BOLD : NORMAL);
    text(`Green: ${p1Label}`, boardX + 28, panelY + panelH / 2);
    if (p1Active) { fill(100, 220, 120); textSize(10); text('\u25B6', boardX + 3, panelY + panelH / 2 - 10); }

    // Player 2
    const p2Active = playerTurn === 2;
    const p2X = boardX + boardWidth / 2 + 3;
    if (p2Active) {
        fill(player2Color[0], player2Color[1], player2Color[2], 25);
        noStroke();
        rect(p2X, panelY, boardWidth / 2 + 3, panelH, 0, 6, 6, 0);
    }
    fill(p2Active ? 255 : 140);
    noStroke();
    ellipse(p2X + 14, panelY + panelH / 2, 16, 16);
    fill(player2Color[0], player2Color[1], player2Color[2]);
    ellipse(p2X + 14, panelY + panelH / 2, 12, 12);
    fill(p2Active ? 230 : 130, p2Active ? 240 : 140, p2Active ? 230 : 130);
    textStyle(p2Active ? BOLD : NORMAL);
    textSize(14);
    text(`Gold: ${p2Label}`, p2X + 28, panelY + panelH / 2);
    if (p2Active) { fill(230, 220, 80); textSize(10); text('\u25B6', p2X + 3, panelY + panelH / 2 - 10); }

    pop();
}

function drawPieceCounts() {
    if (!game.board) return;
    push();
    const p1Count = game.board.pieces.filter(p => p.team === 1).length;
    const p2Count = game.board.pieces.filter(p => p.team === 2).length;
    textAlign(CENTER, CENTER);
    textSize(12);
    fill(140, 155, 140);
    const cy = boardY + boardHeight + 18;
    text(`Green: ${p1Count} pieces`, boardX + boardWidth * 0.25, cy);
    text(`Gold: ${p2Count} pieces`, boardX + boardWidth * 0.75, cy);
    pop();
}

// ============================================
// Game setup
// ============================================

function setupGame() {
    let pieces = [];
    let id = 0;

    // Team 1 (rows 0-2)
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
            let x = col * 2 + (row % 2 === 0 ? 0 : 1);
            pieces.push(new Piece(id++, x, row, 1));
        }
    }

    // Team 2 (rows 5-7)
    for (let row = 5; row < 8; row++) {
        for (let col = 0; col < 4; col++) {
            let x = col * 2 + (row % 2 === 0 ? 0 : 1);
            pieces.push(new Piece(id++, x, row, 2));
        }
    }

    game = new Game(new Board(pieces));
    playerTurn = 1;
}

function resetGame() {
    aiMoveScheduled = false;
    pieceSelected = null;
    gameOverWinner = null;
    gameStateHistory = new Map();
    setupGame();
}

// ============================================
// Move logic
// ============================================

function findAvailableMoves(piece) {
    let moves = [];
    let x = piece.x0;
    let y = piece.y0;

    const dirs = [[1,-1],[2,-2],[-1,-1],[-2,-2],[1,1],[2,2],[-1,1],[-2,2]];
    for (let [dx, dy] of dirs) {
        if (validJump(piece, x + dx, y + dy)) moves.push([x + dx, y + dy]);
    }

    if (piece.king) {
        for (let i = -7; i <= 7; i++) {
            if (i === 0) continue;
            if (validJump(piece, x + i, y + i)) moves.push([x + i, y + i]);
            if (validJump(piece, x + i, y - i)) moves.push([x + i, y - i]);
        }
    }

    return moves;
}

function validJump(piece, x, y) {
    if (x < 0 || x > 7 || y < 0 || y > 7) return false;
    if (Math.abs(piece.x0 - x) !== Math.abs(piece.y0 - y)) return false;
    if (piece.x0 === x && piece.y0 === y) return false;
    if (Math.abs(piece.x0 - x) > 2 && !piece.king) return false;

    if (game.board.pieces.find(p => p.x === x && p.y === y && p.id !== piece.id)) return false;

    let midPiece = game.board.pieces.find(p => p.x === (piece.x0 + x) / 2 && p.y === (piece.y0 + y) / 2 && p.team === piece.team);
    if (midPiece) return false;

    if (Math.abs(piece.x0 - x) === 2 && !piece.king) {
        let enemyMid = game.board.pieces.find(p => p.x === (piece.x0 + x) / 2 && p.y === (piece.y0 + y) / 2 && p.team !== piece.team);
        if (!enemyMid) return false;
    }

    return true;
}

function piceKilled(piece, x, y) {
    if (Math.abs(piece.x0 - x) > 1) {
        const startx = Math.min(piece.x0, x);
        const endx = Math.max(piece.x0, x);
        const starty = Math.min(piece.y0, y);
        const endy = Math.max(piece.y0, y);
        for (let xi = startx + 1, yi = starty + 1; xi < endx && yi < endy; xi++, yi++) {
            let other = game.board.pieces.find(p => p.x === xi && p.y === yi && p.team !== piece.team);
            if (other) return other;
        }
    }
    return false;
}

function canKillMore(piece) {
    let moves = findAvailableMoves(piece);
    for (let move of moves) {
        if (piceKilled(piece, move[0], move[1])) return move;
    }
    return null;
}

function movePiece(piece, x, y) {
    if (!validJump(piece, x, y)) {
        piece.x = piece.x0;
        piece.y = piece.y0;
        return;
    }

    piece.x = x;
    piece.y = y;

    // King promotion
    if (piece.team === 1 && piece.y === 7) piece.king = true;
    if (piece.team === 2 && piece.y === 0) piece.king = true;

    const killed = piceKilled(piece, x, y);
    piece.x0 = x;
    piece.y0 = y;

    if (killed) {
        game.board.pieces = game.board.pieces.filter(p => p.id !== killed.id);
        if (!canKillMore(piece)) {
            playerTurn = playerTurn === 1 ? 2 : 1;
            pieceSelected = null;
            recordBoardState();
        }
    } else {
        playerTurn = playerTurn === 1 ? 2 : 1;
        pieceSelected = null;
        recordBoardState();
    }
}

// ============================================
// AI integration
// ============================================

function scheduleAIMove() {
    if (aiMoveScheduled || gameOverWinner) return;
    if (tournamentMode && !tournamentGameActive) return;
    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;
    if (currentPlayerType === PLAYER_HUMAN) return;

    aiMoveScheduled = true;
    const delay = tournamentMode ? TOURNAMENT_MOVE_DELAY : AI_MOVE_DELAY;
    setTimeout(() => {
        executeAIMove();
        aiMoveScheduled = false;
    }, delay);
}

function executeAIMove() {
    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;

    // Chain captures
    if (pieceSelected !== null) {
        const chainMove = canKillMore(pieceSelected);
        if (chainMove) {
            movePiece(pieceSelected, chainMove[0], chainMove[1]);
            checkGameOver();
            return;
        }
    }

    let result = getAIMove(currentPlayerType, playerTurn);
    if (result === null) {
        const winner = playerTurn === 1 ? 2 : 1;
        if (tournamentMode === 'round_robin') {
            recordTournamentResult(winner);
        } else if (tournamentMode === 'bracket') {
            recordBracketResult(winner);
        } else {
            gameOverWinner = winner;
        }
        return;
    }

    // Anti-repetition: if this move leads to a 3-fold repeated position, try an alternative
    const nextTurn = playerTurn === 1 ? 2 : 1;
    const simResult = applyMoveOnBoard(game.board, result.piece, result.move[0], result.move[1]);
    if (wouldRepeat(simResult.board, nextTurn)) {
        const allMoves = getAllMovesForTeam(game.board, playerTurn);
        const nonRepeating = allMoves.filter(m => {
            const sim = applyMoveOnBoard(game.board, m.piece, m.move[0], m.move[1]);
            return !wouldRepeat(sim.board, nextTurn);
        });
        if (nonRepeating.length > 0) {
            result = nonRepeating[Math.floor(Math.random() * nonRepeating.length)];
        }
    }

    const piece = game.board.pieces.find(p => p.id === result.piece.id);
    if (piece) {
        pieceSelected = piece;
        piece.x0 = piece.x;
        piece.y0 = piece.y;
        movePiece(piece, result.move[0], result.move[1]);
        checkGameOver();
    }
}

function checkGameOver() {
    if (tournamentMode) {
        if (tournamentMode === 'bracket') return checkBracketGameEnd();
        return checkTournamentGameEnd();
    }
    if (game.board.pieces.filter(p => p.team === 1).length === 0 ||
        getAllMovesForTeam(game.board, 1).length === 0) {
        gameOverWinner = 2;
        return true;
    }
    if (game.board.pieces.filter(p => p.team === 2).length === 0 ||
        getAllMovesForTeam(game.board, 2).length === 0) {
        gameOverWinner = 1;
        return true;
    }
    return false;
}

// Legacy auto-play (greedy single step)
function autoPlay() {
    if (pieceSelected) {
        let move = canKillMore(pieceSelected);
        if (move) { movePiece(pieceSelected, move[0], move[1]); return; }
    }

    let pieces = game.board.pieces.filter(p => p.team === playerTurn);
    let moves = [];
    for (let p of pieces) {
        let pMoves = findAvailableMoves(p);
        if (pMoves.length > 0) {
            let best = pMoves.reduce((a, b) => Math.abs(p.x0 - b[0]) > Math.abs(p.x0 - a[0]) ? b : a);
            moves.push({ piece: p, move: best, length: Math.abs(p.x0 - best[0]) });
        }
    }
    if (moves.length === 0) return;
    moves.sort((a, b) => b.length - a.length);
    const maxLen = moves[0].length;
    const best = moves.filter(m => m.length === maxLen);
    const chosen = best[Math.floor(Math.random() * best.length)];
    pieceSelected = chosen.piece;
    movePiece(chosen.piece, chosen.move[0], chosen.move[1]);
}

// ============================================
// Input handling
// ============================================

function mousePressed() {
    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;
    if (currentPlayerType !== PLAYER_HUMAN) return;
    const mx = scaledMouseX(), my = scaledMouseY();
    if (mx < boardX || mx > boardX + boardWidth || my < boardY || my > boardY + boardHeight) return;

    let x = Math.floor((mx - boardX) / squareWidth);
    let y = Math.floor((my - boardY) / squareHeight);
    let piece = game.board.pieces.find(p => p.x === x && p.y === y && p.team === playerTurn);
    if (piece) {
        // Mandatory capture: only allow selecting pieces that can capture
        if (teamHasCapture(playerTurn)) {
            piece.x0 = piece.x; piece.y0 = piece.y;
            const moves = findAvailableMoves(piece);
            if (!moves.some(m => piceKilled(piece, m[0], m[1]))) return;
        }
        pieceSelected = piece;
        piece.x0 = piece.x;
        piece.y0 = piece.y;
    }
}

function mouseDragged() {
    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;
    if (currentPlayerType !== PLAYER_HUMAN || !pieceSelected) return;
    const mx = scaledMouseX(), my = scaledMouseY();
    pieceSelected.x = Math.floor((mx - boardX) / squareWidth);
    pieceSelected.y = Math.floor((my - boardY) / squareHeight);
}

function mouseReleased() {
    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;
    if (currentPlayerType !== PLAYER_HUMAN || !pieceSelected) return;
    const mx = scaledMouseX(), my = scaledMouseY();
    let x = Math.floor((mx - boardX) / squareWidth);
    let y = Math.floor((my - boardY) / squareHeight);
    // Mandatory capture: reject non-capture moves when captures exist
    if (teamHasCapture(playerTurn) && !piceKilled(pieceSelected, x, y)) {
        pieceSelected.x = pieceSelected.x0;
        pieceSelected.y = pieceSelected.y0;
        return;
    }
    movePiece(pieceSelected, x, y);
    checkGameOver();
}

function mouseMoved() {
    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;
    if (currentPlayerType !== PLAYER_HUMAN) { cursor('default'); return; }
    const mx = scaledMouseX(), my = scaledMouseY();
    let x = Math.floor((mx - boardX) / squareWidth);
    let y = Math.floor((my - boardY) / squareHeight);
    cursor(game.board.pieces.find(p => p.x === x && p.y === y && p.team === playerTurn) ? 'grab' : 'default');
}

function mouseWheel(event) {
    if (handleGameLogScroll(event)) return false;
}

// ============================================
// p5.js setup and draw
// ============================================

let player1Select, player2Select;

// Scale factor for CSS-scaled canvas mouse coordinates
function getCanvasScale() {
    const canvas = document.querySelector('#canvas-wrapper canvas');
    if (!canvas) return 1;
    return WIDTH / canvas.offsetWidth;
}

function scaledMouseX() { return mouseX * getCanvasScale(); }
function scaledMouseY() { return mouseY * getCanvasScale(); }

function setup() {
    const cnv = createCanvas(WIDTH, HEIGHT);
    cnv.parent('canvas-wrapper');

    player1 = new Player(1, 1);
    player2 = new Player(2, 2);

    // Wire up HTML select elements
    player1Select = document.getElementById('player1-select');
    player2Select = document.getElementById('player2-select');

    const options = [
        ['Human', PLAYER_HUMAN],
        ['Random', PLAYER_RANDOM],
        ['Greedy', PLAYER_GREEDY],
        ['Super Greedy', PLAYER_SUPER_GREEDY],
        ['Defensive', PLAYER_DEFENSIVE],
        ['Adaptive', PLAYER_ADAPTIVE],
        ['Minimax', PLAYER_MINIMAX],
        ['MCTS', PLAYER_MCTS],
        ['Positional', PLAYER_POSITIONAL]
    ];
    for (const [label, val] of options) {
        const o1 = new Option(label, val);
        const o2 = new Option(label, val);
        player1Select.add(o1);
        player2Select.add(o2);
    }
    player1Select.addEventListener('change', () => { player1Type = player1Select.value; });
    player2Select.addEventListener('change', () => { player2Type = player2Select.value; });

    // Wire up HTML buttons
    document.getElementById('btn-round-robin').addEventListener('click', startRoundRobinTournament);
    document.getElementById('btn-bracket').addEventListener('click', startBracketTournament);
    document.getElementById('btn-auto-step').addEventListener('click', autoPlay);
    document.getElementById('btn-reset').addEventListener('click', () => {
        tournamentMode = null;
        tournamentGameActive = false;
        bracketRounds = [];
        tournamentResults = {};
        tournamentGameLog = [];
        gameLogScrollOffset = 0;
        player1Type = PLAYER_HUMAN;
        player2Type = PLAYER_HUMAN;
        player1Select.value = PLAYER_HUMAN;
        player2Select.value = PLAYER_HUMAN;
        resetGame();
    });

    setupGame();
}

function draw() {
    background(30, 32, 48);
    game.draw();
    drawAvailableMoves();
    drawPlayerInfo();
    drawPieceCounts();

    // Tournament visualization
    const hasRRResults = Object.keys(tournamentResults).length > 0 && AI_TYPES.some(t => tournamentResults[t] && tournamentResults[t].points > 0);
    const hasBracketData = bracketRounds.length > 0;

    if (tournamentMode === 'round_robin' || (!tournamentMode && hasRRResults && !hasBracketData)) {
        drawRoundRobinViz();
        drawGameLog();
    } else if (tournamentMode === 'bracket' || (!tournamentMode && hasBracketData)) {
        drawBracketViz();
        drawGameLog();
    }

    // Game over banner (non-tournament)
    if (gameOverWinner && !tournamentMode) {
        push();
        const bannerY = boardY + boardHeight / 2 - 30;
        fill(0, 0, 0, 170);
        noStroke();
        rect(boardX - 6, bannerY, boardWidth + 12, 60, 8);
        textAlign(CENTER, CENTER);
        textSize(22);
        textStyle(BOLD);
        const wc = gameOverWinner === 1 ? player1Color : player2Color;
        fill(wc[0], wc[1], wc[2]);
        const winLabel = gameOverWinner === 1 ? 'Green' : 'Gold';
        text(`${winLabel} wins!`, boardX + boardWidth / 2, bannerY + 30);
        pop();
    }

    scheduleAIMove();
}
