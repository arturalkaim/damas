/**
 * Tournament System for Checkers AI Arena
 *
 * Two tournament modes:
 * - Round Robin: Every AI plays every other AI (7 AIs = 42 games)
 * - Bracket: Single-elimination with best-of-2 matches (7 AIs + 1 bye)
 *
 * Includes live visualization for both modes.
 */

// ============================================
// Tournament state
// ============================================

let tournamentMode = null; // null, 'round_robin', or 'bracket'
let tournamentResults = {};
let tournamentMatchups = [];
let currentMatchup = 0;
let gamesPerMatchup = 2;
let currentGameInMatchup = 0;
let tournamentMoveCount = 0;
const MAX_TOURNAMENT_MOVES = 500;
const TOURNAMENT_MOVE_DELAY = 50;

let tournamentGameActive = false; // true while a tournament game is being played

// Game history log: { p1: type, p2: type, winner: 0/1/2, moves: number }
let tournamentGameLog = [];
let gameLogScrollOffset = 0;

// Bracket state
let bracketRounds = [];
let bracketCurrentRound = 0;
let bracketCurrentMatch = 0;
let bracketCurrentGame = 0;
let bracketMatchScores = [0, 0];

// Seeding order (strongest to weakest)
const BRACKET_SEEDS = [
    PLAYER_MCTS, PLAYER_MINIMAX, PLAYER_ADAPTIVE, PLAYER_POSITIONAL,
    PLAYER_SUPER_GREEDY, PLAYER_DEFENSIVE, PLAYER_GREEDY, PLAYER_RANDOM
];

// ============================================
// Round Robin
// ============================================

function initTournament() {
    tournamentResults = {};
    tournamentMatchups = [];
    tournamentGameLog = [];
    gameLogScrollOffset = 0;
    bracketRounds = [];
    for (let ai of AI_TYPES) {
        tournamentResults[ai] = { wins: 0, losses: 0, draws: 0, points: 0 };
    }
    for (let i = 0; i < AI_TYPES.length; i++) {
        for (let j = i + 1; j < AI_TYPES.length; j++) {
            tournamentMatchups.push([AI_TYPES[i], AI_TYPES[j]]);
        }
    }
    currentMatchup = 0;
    currentGameInMatchup = 0;
}

function runTournamentGame() {
    if (!tournamentMode) return;
    tournamentGameActive = true;
    const matchup = tournamentMatchups[currentMatchup];
    if (currentGameInMatchup === 0) {
        player1Type = matchup[0];
        player2Type = matchup[1];
    } else {
        player1Type = matchup[1];
        player2Type = matchup[0];
    }
    tournamentMoveCount = 0;
    resetGame();
}

function recordTournamentResult(winner) {
    tournamentGameActive = false;
    const matchup = tournamentMatchups[currentMatchup];
    const p1Type = currentGameInMatchup === 0 ? matchup[0] : matchup[1];
    const p2Type = currentGameInMatchup === 0 ? matchup[1] : matchup[0];

    // Log the game
    tournamentGameLog.push({
        p1: p1Type,
        p2: p2Type,
        winner: winner,
        moves: tournamentMoveCount
    });
    // Auto-scroll to show latest
    const logVisibleRows = 7;
    if (tournamentGameLog.length > logVisibleRows) {
        gameLogScrollOffset = tournamentGameLog.length - logVisibleRows;
    }

    if (winner === 0) {
        tournamentResults[p1Type].draws++;
        tournamentResults[p2Type].draws++;
        tournamentResults[p1Type].points += 0.5;
        tournamentResults[p2Type].points += 0.5;
    } else if (winner === 1) {
        tournamentResults[p1Type].wins++;
        tournamentResults[p2Type].losses++;
        tournamentResults[p1Type].points += 1;
    } else {
        tournamentResults[p2Type].wins++;
        tournamentResults[p1Type].losses++;
        tournamentResults[p2Type].points += 1;
    }

    currentGameInMatchup++;
    if (currentGameInMatchup >= gamesPerMatchup) {
        currentGameInMatchup = 0;
        currentMatchup++;
    }

    if (currentMatchup >= tournamentMatchups.length) {
        finishTournament();
    } else {
        setTimeout(runTournamentGame, 100);
    }
}

function finishTournament() {
    printTournamentLog('Round Robin');
    tournamentMode = null;
    player1Type = PLAYER_HUMAN;
    player2Type = PLAYER_HUMAN;
}

function startRoundRobinTournament() {
    if (tournamentMode) return;
    tournamentMode = 'round_robin';
    initTournament();
    runTournamentGame();
}

function checkTournamentGameEnd() {
    if (!tournamentMode) return false;
    tournamentMoveCount++;

    const team1Pieces = game.board.pieces.filter(p => p.team === 1).length;
    const team2Pieces = game.board.pieces.filter(p => p.team === 2).length;
    if (team1Pieces === 0) { recordTournamentResult(2); return true; }
    if (team2Pieces === 0) { recordTournamentResult(1); return true; }

    // Check if current player has no valid moves (stalemate = loss)
    const currentTeamMoves = getAllMovesForTeam(game.board, playerTurn);
    if (currentTeamMoves.length === 0) {
        const winner = playerTurn === 1 ? 2 : 1;
        recordTournamentResult(winner);
        return true;
    }

    if (tournamentMoveCount >= MAX_TOURNAMENT_MOVES) { recordTournamentResult(0); return true; }
    return false;
}

// ============================================
// Bracket Tournament
// ============================================

function initBracketTournament() {
    tournamentGameLog = [];
    gameLogScrollOffset = 0;
    bracketRounds = [];
    // Shuffle AIs for random first-round matchups
    const shuffled = [...BRACKET_SEEDS];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const qf = [
        { player1: shuffled[0], player2: shuffled[1], winner: null, scores: [0, 0], status: 'pending' },
        { player1: shuffled[2], player2: shuffled[3], winner: null, scores: [0, 0], status: 'pending' },
        { player1: shuffled[4], player2: shuffled[5], winner: null, scores: [0, 0], status: 'pending' },
        { player1: shuffled[6], player2: shuffled[7], winner: null, scores: [0, 0], status: 'pending' }
    ];
    const sf = [
        { player1: null, player2: null, winner: null, scores: [0, 0], status: 'pending' },
        { player1: null, player2: null, winner: null, scores: [0, 0], status: 'pending' }
    ];
    const final = [
        { player1: null, player2: null, winner: null, scores: [0, 0], status: 'pending' }
    ];
    bracketRounds = [qf, sf, final];
    bracketCurrentRound = 0;
    bracketCurrentMatch = 0;
    bracketCurrentGame = 0;
    bracketMatchScores = [0, 0];
}

function startNextBracketMatch() {
    if (tournamentMode !== 'bracket') return;
    while (bracketCurrentRound < bracketRounds.length) {
        const round = bracketRounds[bracketCurrentRound];
        while (bracketCurrentMatch < round.length) {
            const match = round[bracketCurrentMatch];
            if (match.status === 'pending' && match.player1 && match.player2) {
                match.status = 'active';
                bracketCurrentGame = 0;
                bracketMatchScores = [0, 0];
                runBracketGame();
                return;
            }
            bracketCurrentMatch++;
        }
        advanceBracketWinners();
        bracketCurrentRound++;
        bracketCurrentMatch = 0;
    }
    finishBracketTournament();
}

function advanceBracketWinners() {
    const round = bracketRounds[bracketCurrentRound];
    const nextRound = bracketRounds[bracketCurrentRound + 1];
    if (!nextRound) return;
    for (let i = 0; i < round.length; i++) {
        const nextMatch = nextRound[Math.floor(i / 2)];
        if (i % 2 === 0) nextMatch.player1 = round[i].winner;
        else nextMatch.player2 = round[i].winner;
    }
}

function runBracketGame() {
    if (tournamentMode !== 'bracket') return;
    tournamentGameActive = true;
    const match = bracketRounds[bracketCurrentRound][bracketCurrentMatch];
    if (bracketCurrentGame % 2 === 0) {
        player1Type = match.player1;
        player2Type = match.player2;
    } else {
        player1Type = match.player2;
        player2Type = match.player1;
    }
    tournamentMoveCount = 0;
    resetGame();
}

function recordBracketResult(winner) {
    tournamentGameActive = false;
    const match = bracketRounds[bracketCurrentRound][bracketCurrentMatch];

    // Log the game
    const p1Type = bracketCurrentGame % 2 === 0 ? match.player1 : match.player2;
    const p2Type = bracketCurrentGame % 2 === 0 ? match.player2 : match.player1;
    tournamentGameLog.push({
        p1: p1Type,
        p2: p2Type,
        winner: winner,
        moves: tournamentMoveCount
    });
    const logVisibleRows = 7;
    if (tournamentGameLog.length > logVisibleRows) {
        gameLogScrollOffset = tournamentGameLog.length - logVisibleRows;
    }

    let matchWinner;
    if (winner !== 0) {
        if (bracketCurrentGame % 2 === 0) matchWinner = winner === 1 ? match.player1 : match.player2;
        else matchWinner = winner === 1 ? match.player2 : match.player1;
    }
    if (matchWinner === match.player1) bracketMatchScores[0]++;
    else if (matchWinner === match.player2) bracketMatchScores[1]++;

    match.scores = [...bracketMatchScores];
    bracketCurrentGame++;

    // After 2 games, check if decided or need tiebreaker
    if (bracketCurrentGame >= 2) {
        if (bracketMatchScores[0] !== bracketMatchScores[1]) {
            match.winner = bracketMatchScores[0] > bracketMatchScores[1] ? match.player1 : match.player2;
            match.status = 'complete';
            bracketCurrentMatch++;
            setTimeout(startNextBracketMatch, 200);
            return;
        }
        if (bracketCurrentGame === 2) {
            setTimeout(runBracketGame, 200);
            return;
        }
    }

    // After tiebreaker
    if (bracketCurrentGame >= 3) {
        match.winner = bracketMatchScores[0] >= bracketMatchScores[1] ? match.player1 : match.player2;
        match.status = 'complete';
        bracketCurrentMatch++;
        setTimeout(startNextBracketMatch, 200);
        return;
    }

    setTimeout(runBracketGame, 200);
}

function checkBracketGameEnd() {
    if (tournamentMode !== 'bracket') return false;
    tournamentMoveCount++;
    const team1Pieces = game.board.pieces.filter(p => p.team === 1).length;
    const team2Pieces = game.board.pieces.filter(p => p.team === 2).length;
    if (team1Pieces === 0) { recordBracketResult(2); return true; }
    if (team2Pieces === 0) { recordBracketResult(1); return true; }

    // Check if current player has no valid moves (stalemate = loss)
    const currentTeamMoves = getAllMovesForTeam(game.board, playerTurn);
    if (currentTeamMoves.length === 0) {
        const winner = playerTurn === 1 ? 2 : 1;
        recordBracketResult(winner);
        return true;
    }

    if (tournamentMoveCount >= MAX_TOURNAMENT_MOVES) { recordBracketResult(0); return true; }
    return false;
}

function finishBracketTournament() {
    printTournamentLog('Bracket');
    tournamentMode = null;
    player1Type = PLAYER_HUMAN;
    player2Type = PLAYER_HUMAN;
}

function startBracketTournament() {
    if (tournamentMode) return;
    tournamentMode = 'bracket';
    initBracketTournament();
    startNextBracketMatch();
}

// ============================================
// Tournament Visualization
// ============================================

function drawRoundRobinViz() {
    push();

    // Panel background
    fill(30, 40, 30, 230);
    stroke(100, 140, 100);
    strokeWeight(2);
    rect(vizX, vizY, vizWidth, vizHeight, 8);

    noStroke();
    fill(220, 240, 220);
    textSize(20);
    textAlign(CENTER, TOP);
    textStyle(BOLD);
    text('Round Robin Tournament', vizX + vizWidth / 2, vizY + 12);

    // Progress
    const totalGames = tournamentMatchups.length * gamesPerMatchup;
    const completedGames = currentMatchup * gamesPerMatchup + currentGameInMatchup;
    textSize(13);
    textStyle(NORMAL);
    fill(170, 190, 170);

    if (tournamentMode === 'round_robin' && currentMatchup < tournamentMatchups.length) {
        text(`Game ${completedGames + 1} of ${totalGames}  |  ${AI_NAMES[player1Type]} vs ${AI_NAMES[player2Type]}`, vizX + vizWidth / 2, vizY + 38);
    } else {
        text(`Complete: ${totalGames} games played`, vizX + vizWidth / 2, vizY + 38);
    }

    // Table
    const tableX = vizX + 20;
    const tableY = vizY + 68;
    const rowH = 38;
    const colWidths = [40, 160, 55, 55, 55, 65];

    textAlign(LEFT, CENTER);
    textSize(13);
    textStyle(BOLD);
    fill(150, 180, 150);
    const headers = ['#', 'AI Name', 'W', 'L', 'D', 'Pts'];
    let cx = tableX;
    for (let i = 0; i < headers.length; i++) {
        text(headers[i], cx + 8, tableY + rowH / 2);
        cx += colWidths[i];
    }

    stroke(80, 110, 80);
    strokeWeight(1);
    line(tableX, tableY + rowH - 4, tableX + vizWidth - 40, tableY + rowH - 4);
    noStroke();

    const sorted = AI_TYPES
        .map(ai => ({ type: ai, ...tournamentResults[ai] }))
        .sort((a, b) => b.points - a.points || b.wins - a.wins);

    textStyle(NORMAL);
    textSize(14);
    for (let i = 0; i < sorted.length; i++) {
        const ai = sorted[i];
        const ry = tableY + rowH + i * rowH;
        const isPlaying = tournamentMode === 'round_robin' && (ai.type === player1Type || ai.type === player2Type);

        if (isPlaying) {
            fill(60, 100, 60, 180);
            noStroke();
            rect(tableX, ry - 2, vizWidth - 40, rowH - 2, 4);
        }

        if (i === 0) fill(255, 215, 0);
        else if (i === 1) fill(192, 192, 192);
        else if (i === 2) fill(205, 127, 50);
        else fill(200, 220, 200);

        cx = tableX;
        textAlign(LEFT, CENTER);
        text(`${i + 1}`, cx + 8, ry + rowH / 2 - 2);
        cx += colWidths[0];

        fill(isPlaying ? 255 : 200, isPlaying ? 255 : 220, isPlaying ? 255 : 200);
        textStyle(isPlaying ? BOLD : NORMAL);
        text(AI_NAMES[ai.type], cx + 8, ry + rowH / 2 - 2);
        cx += colWidths[1];

        fill(200, 220, 200);
        textStyle(NORMAL);
        text(`${ai.wins}`, cx + 8, ry + rowH / 2 - 2);
        cx += colWidths[2];
        text(`${ai.losses}`, cx + 8, ry + rowH / 2 - 2);
        cx += colWidths[3];
        text(`${ai.draws}`, cx + 8, ry + rowH / 2 - 2);
        cx += colWidths[4];
        textStyle(BOLD);
        fill(220, 240, 180);
        text(`${ai.points.toFixed(1)}`, cx + 8, ry + rowH / 2 - 2);
    }

    // Champion when done
    if (!tournamentMode && sorted[0].points > 0) {
        const champY = tableY + rowH + sorted.length * rowH + 15;
        textAlign(CENTER, CENTER);
        textSize(18);
        textStyle(BOLD);
        fill(255, 215, 0);
        text(`Champion: ${AI_NAMES[sorted[0].type]}`, vizX + vizWidth / 2, champY);
    }

    pop();
}

function drawBracketViz() {
    push();

    fill(30, 40, 30, 230);
    stroke(100, 140, 100);
    strokeWeight(2);
    rect(vizX, vizY, vizWidth, vizHeight, 8);

    noStroke();
    fill(220, 240, 220);
    textSize(20);
    textAlign(CENTER, TOP);
    textStyle(BOLD);
    text('Bracket Tournament', vizX + vizWidth / 2, vizY + 12);

    const roundNames = ['Quarter-Finals', 'Semi-Finals', 'Final'];
    const roundX = [vizX + 20, vizX + 200, vizX + 380];
    const matchW = 160;
    const matchH = 50;

    textSize(11);
    textStyle(NORMAL);
    fill(150, 170, 150);
    textAlign(CENTER, TOP);
    for (let r = 0; r < 3; r++) {
        text(roundNames[r], roundX[r] + matchW / 2, vizY + 38);
    }

    const qfY = [vizY + 62, vizY + 122, vizY + 222, vizY + 282];
    const sfY = [vizY + 92, vizY + 252];
    const finalY = [vizY + 172];
    const allY = [qfY, sfY, finalY];

    // Connecting lines
    stroke(80, 120, 80);
    strokeWeight(1.5);
    for (let r = 0; r < 2; r++) {
        for (let m = 0; m < bracketRounds[r].length; m++) {
            const fromX = roundX[r] + matchW;
            const fromY = allY[r][m] + matchH / 2;
            const toX = roundX[r + 1];
            const toY = allY[r + 1][Math.floor(m / 2)] + matchH / 2;
            const midX = (fromX + toX) / 2;
            line(fromX, fromY, midX, fromY);
            line(midX, fromY, midX, toY);
            line(midX, toY, toX, toY);
        }
    }

    // Match boxes
    for (let r = 0; r < bracketRounds.length; r++) {
        for (let m = 0; m < bracketRounds[r].length; m++) {
            drawBracketMatchBox(roundX[r], allY[r][m], matchW, matchH, bracketRounds[r][m]);
        }
    }

    // Champion
    const finalMatch = bracketRounds[2][0];
    if (finalMatch.winner) {
        noStroke();
        fill(255, 215, 0, 20 + 10 * sin(frameCount * 0.05));
        ellipse(vizX + vizWidth / 2, vizY + vizHeight - 48, 120, 50);
        textAlign(CENTER, CENTER);
        textSize(22);
        textStyle(BOLD);
        fill(255, 215, 0);
        text(`Champion: ${AI_NAMES[finalMatch.winner]}`, vizX + vizWidth / 2, vizY + vizHeight - 48);
        textSize(14);
        fill(255, 215, 0, 180);
        text('\u2605 \u2605 \u2605', vizX + vizWidth / 2, vizY + vizHeight - 25);
    }

    pop();
}

function drawBracketMatchBox(x, y, w, h, match) {
    const isActive = match.status === 'active';
    const isComplete = match.status === 'complete';
    const isBye = match.status === 'bye';
    const isPending = match.status === 'pending';

    let pulseAlpha = 255;
    if (isActive) pulseAlpha = 180 + 75 * sin(frameCount * 0.08);

    if (isActive) fill(40, 70, 40, pulseAlpha);
    else if (isComplete) fill(35, 50, 35, 220);
    else if (isBye) fill(40, 45, 40, 180);
    else fill(30, 38, 30, 180);

    if (isActive) { stroke(80, 200, 80, pulseAlpha); strokeWeight(2.5); }
    else if (isComplete) { stroke(100, 130, 100); strokeWeight(1.5); }
    else { stroke(isBye ? 80 : 60, isBye ? 90 : 80, isBye ? 80 : 60); strokeWeight(1); drawingContext.setLineDash([4, 4]); }

    rect(x, y, w, h, 5);
    drawingContext.setLineDash([]);
    noStroke();

    const p1Name = match.player1 ? AI_NAMES[match.player1] : '???';
    const p2Name = isBye ? 'BYE' : (match.player2 ? AI_NAMES[match.player2] : '???');
    const isP1Winner = match.winner === match.player1 && isComplete;
    const isP2Winner = match.winner === match.player2 && isComplete;

    textAlign(LEFT, CENTER);
    textSize(12);

    // Player 1
    if (isBye) { fill(180, 200, 180); textStyle(ITALIC); }
    else if (isP1Winner) { fill(120, 255, 120); textStyle(BOLD); }
    else if (isActive) { fill(220, 240, 220); textStyle(NORMAL); }
    else { fill(160, 180, 160); textStyle(NORMAL); }
    text(p1Name, x + 8, y + h * 0.28);

    // Player 2
    if (isBye) { fill(100, 110, 100); textStyle(ITALIC); }
    else if (isP2Winner) { fill(120, 255, 120); textStyle(BOLD); }
    else if (isActive) { fill(220, 240, 220); textStyle(NORMAL); }
    else { fill(160, 180, 160); textStyle(NORMAL); }
    text(p2Name, x + 8, y + h * 0.72);

    // Scores
    if (!isBye && !isPending && match.player1 && match.player2) {
        textAlign(RIGHT, CENTER);
        textSize(13);
        textStyle(BOLD);
        fill(isP1Winner ? 120 : 180, isP1Winner ? 255 : 200, isP1Winner ? 120 : 180);
        text(`${match.scores[0]}`, x + w - 10, y + h * 0.28);
        fill(isP2Winner ? 120 : 180, isP2Winner ? 255 : 200, isP2Winner ? 120 : 180);
        text(`${match.scores[1]}`, x + w - 10, y + h * 0.72);
    }

    // Divider
    stroke(60, 80, 60);
    strokeWeight(0.5);
    line(x + 4, y + h / 2, x + w - 4, y + h / 2);
    noStroke();
}

// ============================================
// Game History Log
// ============================================

const GAME_LOG_VISIBLE_ROWS = 7;

function drawGameLog() {
    if (tournamentGameLog.length === 0) return;

    push();

    const logX = vizX;
    const logY = vizY + vizHeight + 10;
    const logW = vizWidth;
    const rowH = 22;
    const headerH = 32;
    const logH = headerH + GAME_LOG_VISIBLE_ROWS * rowH + 10;

    // Card background
    fill(30, 40, 30, 230);
    stroke(100, 140, 100);
    strokeWeight(2);
    rect(logX, logY, logW, logH, 8);
    noStroke();

    // Header
    fill(200, 220, 200);
    textSize(14);
    textAlign(LEFT, CENTER);
    textStyle(BOLD);
    text('Game Log', logX + 14, logY + headerH / 2);

    // Count badge
    textSize(11);
    textStyle(NORMAL);
    fill(130, 160, 130);
    textAlign(RIGHT, CENTER);
    text(`${tournamentGameLog.length} games`, logX + logW - 14, logY + headerH / 2);

    // Divider under header
    stroke(80, 110, 80);
    strokeWeight(1);
    line(logX + 8, logY + headerH, logX + logW - 8, logY + headerH);
    noStroke();

    // Clip region for scrollable content
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(logX, logY + headerH, logW, GAME_LOG_VISIBLE_ROWS * rowH + 8);
    drawingContext.clip();

    // Draw visible rows
    const maxOffset = Math.max(0, tournamentGameLog.length - GAME_LOG_VISIBLE_ROWS);
    gameLogScrollOffset = constrain(gameLogScrollOffset, 0, maxOffset);

    textSize(12);
    for (let i = 0; i < GAME_LOG_VISIBLE_ROWS && i + gameLogScrollOffset < tournamentGameLog.length; i++) {
        const entry = tournamentGameLog[i + gameLogScrollOffset];
        const ry = logY + headerH + 4 + i * rowH;

        // Alternate row shading
        if (i % 2 === 1) {
            fill(40, 55, 40, 100);
            noStroke();
            rect(logX + 4, ry, logW - 8, rowH, 2);
        }

        const gameNum = i + gameLogScrollOffset + 1;
        const p1Name = AI_NAMES[entry.p1] || 'Unknown';
        const p2Name = AI_NAMES[entry.p2] || 'Unknown';

        // Game number
        textAlign(LEFT, CENTER);
        textStyle(NORMAL);
        fill(120, 140, 120);
        text(`${gameNum}.`, logX + 14, ry + rowH / 2);

        // Player 1 name
        const isP1Winner = entry.winner === 1;
        const isP2Winner = entry.winner === 2;
        const isDraw = entry.winner === 0;

        fill(isP1Winner ? [120, 255, 120] : [180, 200, 180]);
        textStyle(isP1Winner ? BOLD : NORMAL);
        text(p1Name, logX + 44, ry + rowH / 2);

        // "vs"
        fill(100, 120, 100);
        textStyle(NORMAL);
        text('vs', logX + 165, ry + rowH / 2);

        // Player 2 name
        fill(isP2Winner ? [120, 255, 120] : [180, 200, 180]);
        textStyle(isP2Winner ? BOLD : NORMAL);
        text(p2Name, logX + 190, ry + rowH / 2);

        // Result
        textAlign(RIGHT, CENTER);
        if (isDraw) {
            fill(180, 180, 100);
            textStyle(NORMAL);
            text('Draw', logX + logW - 80, ry + rowH / 2);
        } else {
            const winnerName = isP1Winner ? p1Name : p2Name;
            fill(100, 220, 120);
            textStyle(BOLD);
            text(winnerName, logX + logW - 80, ry + rowH / 2);
        }

        // Move count
        fill(110, 130, 110);
        textStyle(NORMAL);
        textSize(10);
        text(`${entry.moves}m`, logX + logW - 14, ry + rowH / 2);
        textSize(12);
    }

    drawingContext.restore();

    // Scrollbar if needed
    if (tournamentGameLog.length > GAME_LOG_VISIBLE_ROWS) {
        const scrollAreaH = GAME_LOG_VISIBLE_ROWS * rowH;
        const scrollBarH = Math.max(20, scrollAreaH * (GAME_LOG_VISIBLE_ROWS / tournamentGameLog.length));
        const scrollBarY = logY + headerH + (scrollAreaH - scrollBarH) * (gameLogScrollOffset / maxOffset);
        fill(80, 110, 80, 150);
        noStroke();
        rect(logX + logW - 8, scrollBarY, 4, scrollBarH, 2);
    }

    pop();
}

function printTournamentLog(type) {
    const lines = [`=== ${type} Tournament Results ===`];
    for (let i = 0; i < tournamentGameLog.length; i++) {
        const e = tournamentGameLog[i];
        const p1 = AI_NAMES[e.p1];
        const p2 = AI_NAMES[e.p2];
        const result = e.winner === 0 ? 'Draw' : (e.winner === 1 ? p1 : p2);
        lines.push(`${i + 1}. ${p1} vs ${p2} → ${result} (${e.moves}m)`);
    }
    if (type === 'Round Robin') {
        lines.push('--- Standings ---');
        const sorted = AI_TYPES
            .map(ai => ({ type: ai, ...tournamentResults[ai] }))
            .sort((a, b) => b.points - a.points || b.wins - a.wins);
        for (let i = 0; i < sorted.length; i++) {
            const s = sorted[i];
            lines.push(`${i + 1}. ${AI_NAMES[s.type]}: ${s.wins}W ${s.losses}L ${s.draws}D (${s.points}pts)`);
        }
    } else if (type === 'Bracket') {
        const champion = bracketRounds[2][0].winner;
        if (champion) lines.push(`Champion: ${AI_NAMES[champion]}`);
    }
    console.log(lines.join('\n'));
}

function handleGameLogScroll(event) {
    if (tournamentGameLog.length <= GAME_LOG_VISIBLE_ROWS) return false;

    const logX = vizX;
    const logY = vizY + vizHeight + 10;
    const logW = vizWidth;
    const logH = 32 + GAME_LOG_VISIBLE_ROWS * 22 + 10;

    if (mouseX >= logX && mouseX <= logX + logW && mouseY >= logY && mouseY <= logY + logH) {
        const maxOffset = tournamentGameLog.length - GAME_LOG_VISIBLE_ROWS;
        gameLogScrollOffset = constrain(gameLogScrollOffset + (event.delta > 0 ? 1 : -1), 0, maxOffset);
        return true;
    }
    return false;
}
