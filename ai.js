/**
 * AI Algorithms for Checkers
 *
 * Contains 8 AI algorithms:
 * - Random: Pure random baseline
 * - Greedy: Prioritizes captures
 * - Super Greedy: Enhanced greedy with chain captures, safety, advancement
 * - Defensive: Safety-first, avoids losing pieces
 * - Adaptive: Changes strategy based on material advantage
 * - Minimax: Look-ahead with alpha-beta pruning
 * - MCTS: Monte Carlo Tree Search with UCB1 selection
 * - Positional: Patient strategist focused on board structure and formation
 */

// Player type constants
const PLAYER_HUMAN = 'human';
const PLAYER_RANDOM = 'random';
const PLAYER_GREEDY = 'greedy';
const PLAYER_SUPER_GREEDY = 'super_greedy';
const PLAYER_DEFENSIVE = 'defensive';
const PLAYER_ADAPTIVE = 'adaptive';
const PLAYER_MINIMAX = 'minimax';
const PLAYER_MCTS = 'mcts';
const PLAYER_POSITIONAL = 'positional';

const AI_NAMES = {
    [PLAYER_RANDOM]: 'Random',
    [PLAYER_GREEDY]: 'Greedy',
    [PLAYER_SUPER_GREEDY]: 'Super Greedy',
    [PLAYER_DEFENSIVE]: 'Defensive',
    [PLAYER_ADAPTIVE]: 'Adaptive',
    [PLAYER_MINIMAX]: 'Minimax',
    [PLAYER_MCTS]: 'MCTS',
    [PLAYER_POSITIONAL]: 'Positional'
};

const AI_TYPES = [
    PLAYER_RANDOM,
    PLAYER_GREEDY,
    PLAYER_SUPER_GREEDY,
    PLAYER_DEFENSIVE,
    PLAYER_ADAPTIVE,
    PLAYER_MINIMAX,
    PLAYER_MCTS,
    PLAYER_POSITIONAL
];

// Player type configuration
let player1Type = PLAYER_HUMAN;
let player2Type = PLAYER_HUMAN;

// AI delay for visualization (ms)
const AI_MOVE_DELAY = 500;
let aiMoveScheduled = false;

// ============================================
// Board simulation helpers (used by AI)
// ============================================

function cloneBoard(board) {
    const clonedPieces = board.pieces.map(p => {
        const piece = new Piece(p.id, p.x, p.y, p.team);
        piece.x0 = p.x0;
        piece.y0 = p.y0;
        piece.king = p.king;
        return piece;
    });
    return new Board(clonedPieces);
}

function findAvailableMovesOnBoard(piece, board) {
    let moves = [];
    let x = piece.x0;
    let y = piece.y0;

    const directions = [
        [1, -1], [2, -2],
        [-1, -1], [-2, -2],
        [1, 1], [2, 2],
        [-1, 1], [-2, 2]
    ];

    for (let [dx, dy] of directions) {
        if (validJumpOnBoard(piece, x + dx, y + dy, board)) {
            moves.push([x + dx, y + dy]);
        }
    }

    if (piece.king) {
        for (let i = -7; i <= 7; i++) {
            if (i === 0) continue;
            if (validJumpOnBoard(piece, x + i, y + i, board)) {
                moves.push([x + i, y + i]);
            }
            if (validJumpOnBoard(piece, x + i, y - i, board)) {
                moves.push([x + i, y - i]);
            }
        }
    }

    return moves;
}

function validJumpOnBoard(piece, x, y, board) {
    if (x < 0 || x > 7 || y < 0 || y > 7) return false;
    if (Math.abs(piece.x0 - x) !== Math.abs(piece.y0 - y)) return false;
    if (piece.x0 === x && piece.y0 === y) return false;
    if (Math.abs(piece.x0 - x) > 2 && !piece.king) return false;

    let otherPiece = board.pieces.find(p => p.x === x && p.y === y && p.id !== piece.id);
    if (otherPiece != null) return false;

    otherPiece = board.pieces.find(p => p.x === (piece.x0 + x) / 2 && p.y === (piece.y0 + y) / 2 && p.team === piece.team);
    if (otherPiece != null) return false;

    if (Math.abs(piece.x0 - x) === 2 && !piece.king) {
        otherPiece = board.pieces.find(p => p.x === (piece.x0 + x) / 2 && p.y === (piece.y0 + y) / 2 && p.team !== piece.team);
        if (otherPiece == null) return false;
    }

    return true;
}

function pieceKilledOnBoard(piece, x, y, board) {
    if (Math.abs(piece.x0 - x) > 1) {
        const startx = Math.min(piece.x0, x);
        const endx = Math.max(piece.x0, x);
        const starty = Math.min(piece.y0, y);
        const endy = Math.max(piece.y0, y);
        for (let xi = startx + 1, yi = starty + 1; xi < endx && yi < endy; xi++, yi++) {
            let otherPiece = board.pieces.find(p => p.x === xi && p.y === yi && p.team !== piece.team);
            if (otherPiece) return otherPiece;
        }
    }
    return null;
}

function applyMoveOnBoard(board, piece, x, y) {
    const newBoard = cloneBoard(board);
    const newPiece = newBoard.pieces.find(p => p.id === piece.id);

    newPiece.x = x;
    newPiece.y = y;

    const killed = pieceKilledOnBoard(newPiece, x, y, newBoard);
    if (killed) {
        newBoard.pieces = newBoard.pieces.filter(p => p.id !== killed.id);
    }

    newPiece.x0 = x;
    newPiece.y0 = y;

    if (newPiece.team === 1 && newPiece.y === 7) newPiece.king = true;
    if (newPiece.team === 2 && newPiece.y === 0) newPiece.king = true;

    return { board: newBoard, captured: killed !== null };
}

function getAllMovesForTeam(board, team) {
    const moves = [];
    const pieces = board.pieces.filter(p => p.team === team);
    for (let piece of pieces) {
        const pieceMoves = findAvailableMovesOnBoard(piece, board);
        for (let move of pieceMoves) {
            moves.push({ piece: piece, move: move });
        }
    }
    // Mandatory capture: if any capture exists, must capture
    const captures = moves.filter(m =>
        pieceKilledOnBoard(m.piece, m.move[0], m.move[1], board) !== null
    );
    return captures.length > 0 ? captures : moves;
}

function evaluateBoard(board, depth) {
    const team1Pieces = board.pieces.filter(p => p.team === 1);
    const team2Pieces = board.pieces.filter(p => p.team === 2);

    // Win/loss detection with depth penalty (prefer faster wins)
    if (team1Pieces.length === 0) return depth != null ? -(10000 - depth) : -10000;
    if (team2Pieces.length === 0) return depth != null ? (10000 - depth) : 10000;
    const team1Moves = getAllMovesForTeam(board, 1);
    const team2Moves = getAllMovesForTeam(board, 2);
    if (team1Moves.length === 0) return depth != null ? -(10000 - depth) : -10000;
    if (team2Moves.length === 0) return depth != null ? (10000 - depth) : 10000;

    let score = 0;

    for (let piece of board.pieces) {
        const sign = piece.team === 1 ? 1 : -1;

        // Material
        let pieceValue = piece.king ? 25 : 10;

        // Advancement
        if (!piece.king) {
            const advancement = piece.team === 1 ? piece.y : 7 - piece.y;
            pieceValue += advancement * 0.5;
            // Near-kinging bonus
            if (advancement === 6) pieceValue += 5;
        }

        // Center control
        const centerX = Math.abs(3.5 - piece.x);
        const centerY = Math.abs(3.5 - piece.y);
        pieceValue += (4 - centerX - centerY) * 0.3;

        // Safety: penalize threatened pieces
        if (!isSquareSafe(board, piece.x, piece.y, piece.team)) {
            pieceValue -= piece.king ? 15 : 10;
        }

        score += sign * pieceValue;
    }

    // Mobility difference
    score += (team1Moves.length - team2Moves.length) * 0.2;

    // Back rank integrity
    const team1BackRank = team1Pieces.filter(p => p.y === 0).length;
    const team2BackRank = team2Pieces.filter(p => p.y === 7).length;
    if (team1BackRank < 2) score -= 3;
    if (team2BackRank < 2) score += 3;

    return score;
}

function isGameOver(board) {
    const team1Pieces = board.pieces.filter(p => p.team === 1);
    const team2Pieces = board.pieces.filter(p => p.team === 2);
    if (team1Pieces.length === 0) return { over: true, winner: 2 };
    if (team2Pieces.length === 0) return { over: true, winner: 1 };
    const team1Moves = getAllMovesForTeam(board, 1);
    const team2Moves = getAllMovesForTeam(board, 2);
    if (team1Moves.length === 0) return { over: true, winner: 2 };
    if (team2Moves.length === 0) return { over: true, winner: 1 };
    return { over: false, winner: null };
}

// ============================================
// Shared AI utilities
// ============================================

function countChainCaptures(board, piece, x, y, depth = 0) {
    const result = applyMoveOnBoard(board, piece, x, y);
    if (!result.captured) return depth;
    const newPiece = result.board.pieces.find(p => p.id === piece.id);
    if (!newPiece) return depth + 1;
    const captureMoves = findAvailableMovesOnBoard(newPiece, result.board)
        .filter(m => Math.abs(newPiece.x0 - m[0]) === 2);
    if (captureMoves.length === 0) return depth + 1;
    let maxCaptures = depth + 1;
    for (let move of captureMoves) {
        const captures = countChainCaptures(result.board, newPiece, move[0], move[1], depth + 1);
        maxCaptures = Math.max(maxCaptures, captures);
    }
    return maxCaptures;
}

function isSquareSafe(board, x, y, team) {
    const opponent = team === 1 ? 2 : 1;
    const opponentPieces = board.pieces.filter(p => p.team === opponent);
    for (let piece of opponentPieces) {
        const jumpMoves = [
            [piece.x + 2, piece.y + 2],
            [piece.x + 2, piece.y - 2],
            [piece.x - 2, piece.y + 2],
            [piece.x - 2, piece.y - 2]
        ];
        for (let [jx, jy] of jumpMoves) {
            const midX = (piece.x + jx) / 2;
            const midY = (piece.y + jy) / 2;
            if (midX === x && midY === y) {
                if (jx >= 0 && jx <= 7 && jy >= 0 && jy <= 7) {
                    const destOccupied = board.pieces.some(p => p.x === jx && p.y === jy);
                    if (!destOccupied) return false;
                }
            }
        }
    }
    return true;
}

// Small random noise to break ties and add variety between identical matchups
const AI_NOISE = 15;
function aiNoise() { return (Math.random() - 0.5) * AI_NOISE; }

// ============================================
// AI Algorithms
// ============================================

function randomAI(board, team) {
    const moves = getAllMovesForTeam(board, team);
    if (moves.length === 0) return null;
    return moves[Math.floor(Math.random() * moves.length)];
}

function greedyAI(board, team) {
    const moves = getAllMovesForTeam(board, team);
    if (moves.length === 0) return null;

    const hasCaptures = pieceKilledOnBoard(moves[0].piece, moves[0].move[0], moves[0].move[1], board) !== null;
    if (!hasCaptures) {
        // No captures available — pick random
        return moves[Math.floor(Math.random() * moves.length)];
    }

    // Score captures: chain length × 100 + safe destination bonus
    let scoredMoves = [];
    for (let { piece, move } of moves) {
        const chains = countChainCaptures(board, piece, move[0], move[1]);
        const safe = isSquareSafe(board, move[0], move[1], team);
        const score = chains * 100 + (safe ? 50 : 0) + aiNoise();
        scoredMoves.push({ piece, move, score });
    }
    scoredMoves.sort((a, b) => b.score - a.score);
    const maxScore = scoredMoves[0].score;
    const bestMoves = scoredMoves.filter(m => m.score >= maxScore);
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function superGreedyAI(board, team) {
    const moves = getAllMovesForTeam(board, team);
    if (moves.length === 0) return null;

    let allMoves = [];
    for (let { piece, move } of moves) {
        const isCapture = pieceKilledOnBoard(piece, move[0], move[1], board) !== null;
        let totalCaptures = isCapture ? countChainCaptures(board, piece, move[0], move[1]) : 0;
        const safe = isSquareSafe(board, move[0], move[1], team);
        let advancement = 0;
        if (!piece.king) {
            advancement = team === 1 ? move[1] : 7 - move[1];
        }
        const centerX = 4 - Math.abs(3.5 - move[0]);
        const centerY = 4 - Math.abs(3.5 - move[1]);

        // Simulate board after move and count exposed friendly pieces
        const simResult = applyMoveOnBoard(board, piece, move[0], move[1]);
        let exposedPieces = 0;
        for (let p of simResult.board.pieces.filter(p => p.team === team)) {
            if (!isSquareSafe(simResult.board, p.x, p.y, team)) exposedPieces++;
        }

        let score = totalCaptures * 200 + (safe ? 100 : -60) + advancement * 10 + (centerX + centerY) / 2;
        score -= exposedPieces * 120;
        score += aiNoise();
        allMoves.push({ piece, move, score });
    }

    allMoves.sort((a, b) => b.score - a.score);
    const maxScore = allMoves[0].score;
    const threshold = maxScore > 0 ? maxScore * 0.9 : maxScore - 10;
    const bestMoves = allMoves.filter(m => m.score >= threshold);
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function defensiveAI(board, team) {
    const moves = getAllMovesForTeam(board, team);
    if (moves.length === 0) return null;

    let allMoves = [];
    for (let { piece, move } of moves) {
        const isCapture = pieceKilledOnBoard(piece, move[0], move[1], board) !== null;
        const currentlyThreatened = !isSquareSafe(board, piece.x, piece.y, team);
        const destinationSafe = isSquareSafe(board, move[0], move[1], team);
        const simResult = applyMoveOnBoard(board, piece, move[0], move[1]);
        let exposedPieces = 0;
        for (let p of simResult.board.pieces.filter(p => p.team === team)) {
            if (!isSquareSafe(simResult.board, p.x, p.y, team)) exposedPieces++;
        }
        const backRankBonus = team === 1 ? (7 - move[1]) : move[1];
        let score = 0;
        score += currentlyThreatened && destinationSafe ? 500 : 0;
        score += destinationSafe ? 200 : -300;
        score -= exposedPieces * 150;
        score += isCapture && destinationSafe ? 150 : 0;
        score += backRankBonus * 10;
        score += aiNoise();
        allMoves.push({ piece, move, score });
    }

    allMoves.sort((a, b) => b.score - a.score);
    const maxScore = allMoves[0].score;
    const bestMoves = allMoves.filter(m => m.score >= maxScore - 50);
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function adaptiveAI(board, team) {
    const myPieces = board.pieces.filter(p => p.team === team);
    const oppPieces = board.pieces.filter(p => p.team !== team);
    const myMaterial = myPieces.reduce((sum, p) => sum + (p.king ? 25 : 10), 0);
    const oppMaterial = oppPieces.reduce((sum, p) => sum + (p.king ? 25 : 10), 0);
    const advantage = myMaterial - oppMaterial;

    let strategy;
    if (advantage >= 20) strategy = 'defensive';
    else if (advantage <= -20) strategy = 'aggressive';
    else strategy = 'positional';

    const exposurePenalty = { aggressive: 80, positional: 100, defensive: 130 };

    const moves = getAllMovesForTeam(board, team);
    if (moves.length === 0) return null;

    let allMoves = [];
    for (let { piece, move } of moves) {
        const isCapture = pieceKilledOnBoard(piece, move[0], move[1], board) !== null;
        const safe = isSquareSafe(board, move[0], move[1], team);
        let chainCaptures = isCapture ? countChainCaptures(board, piece, move[0], move[1]) : 0;
        const advancement = team === 1 ? move[1] : (7 - move[1]);
        const centerBonus = 4 - Math.abs(3.5 - move[0]) + 4 - Math.abs(3.5 - move[1]);

        // Simulate board after move and count exposed friendly pieces
        const simResult = applyMoveOnBoard(board, piece, move[0], move[1]);
        let exposedPieces = 0;
        for (let p of simResult.board.pieces.filter(p => p.team === team)) {
            if (!isSquareSafe(simResult.board, p.x, p.y, team)) exposedPieces++;
        }

        let score = 0;
        if (strategy === 'aggressive') {
            score += chainCaptures * 200 + (isCapture ? 150 : 0) + advancement * 15 + (safe ? 80 : -60);
        } else if (strategy === 'defensive') {
            score += (safe ? 300 : -200) + ((isCapture && safe) ? 150 : 0) - advancement * 5 + (7 - advancement) * 10;
        } else {
            score += chainCaptures * 100 + (safe ? 150 : -100) + centerBonus * 15 + advancement * 10;
        }
        score -= exposedPieces * exposurePenalty[strategy];
        score += aiNoise();
        allMoves.push({ piece, move, score, strategy });
    }

    allMoves.sort((a, b) => b.score - a.score);
    const maxScore = allMoves[0].score;
    const bestMoves = allMoves.filter(m => m.score >= maxScore - 20);
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// ============================================
// Minimax with Alpha-Beta Pruning
// ============================================

function minimax(board, depth, alpha, beta, maximizingPlayer, currentTeam, maxDepth) {
    const gameStatus = isGameOver(board);
    if (gameStatus.over) {
        const depthPenalty = maxDepth - depth;
        return gameStatus.winner === 1 ? (10000 - depthPenalty) : -(10000 - depthPenalty);
    }
    if (depth === 0) return evaluateBoard(board);

    const moves = getAllMovesForTeam(board, currentTeam);
    // Move ordering: try captures first for better pruning
    moves.sort((a, b) => {
        const aCapture = pieceKilledOnBoard(a.piece, a.move[0], a.move[1], board) !== null ? 1 : 0;
        const bCapture = pieceKilledOnBoard(b.piece, b.move[0], b.move[1], board) !== null ? 1 : 0;
        return bCapture - aCapture;
    });
    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (let { piece, move } of moves) {
            const result = applyMoveOnBoard(board, piece, move[0], move[1]);
            const evalScore = minimax(result.board, depth - 1, alpha, beta, false, currentTeam === 1 ? 2 : 1, maxDepth);
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let { piece, move } of moves) {
            const result = applyMoveOnBoard(board, piece, move[0], move[1]);
            const evalScore = minimax(result.board, depth - 1, alpha, beta, true, currentTeam === 1 ? 2 : 1, maxDepth);
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function minimaxAI(board, team, depth = 4) {
    const moves = getAllMovesForTeam(board, team);
    if (moves.length === 0) return null;
    let bestMove = null;
    let bestScore = team === 1 ? -Infinity : Infinity;
    for (let { piece, move } of moves) {
        const result = applyMoveOnBoard(board, piece, move[0], move[1]);
        const score = minimax(result.board, depth - 1, -Infinity, Infinity, team !== 1, team === 1 ? 2 : 1, depth) + aiNoise();
        if ((team === 1 && score > bestScore) || (team === 2 && score < bestScore)) {
            bestScore = score;
            bestMove = { piece, move };
        }
    }
    return bestMove;
}

// ============================================
// Monte Carlo Tree Search (MCTS)
// ============================================

class MCTSNode {
    constructor(board, team, parent = null, move = null, piece = null) {
        this.board = board;
        this.team = team;
        this.parent = parent;
        this.move = move;
        this.piece = piece;
        this.children = [];
        this.visits = 0;
        this.wins = 0;
        this.untriedMoves = null;
    }

    getUntriedMoves() {
        if (this.untriedMoves === null) {
            this.untriedMoves = getAllMovesForTeam(this.board, this.team);
        }
        return this.untriedMoves;
    }

    ucb1(explorationParam = 1.41) {
        if (this.visits === 0) return Infinity;
        return (this.wins / this.visits) +
               explorationParam * Math.sqrt(Math.log(this.parent.visits) / this.visits);
    }

    selectChild() {
        let bestChild = null;
        let bestUCB = -Infinity;
        for (let child of this.children) {
            const ucb = child.ucb1();
            if (ucb > bestUCB) { bestUCB = ucb; bestChild = child; }
        }
        return bestChild;
    }

    expand() {
        const untriedMoves = this.getUntriedMoves();
        if (untriedMoves.length === 0) return null;
        const idx = Math.floor(Math.random() * untriedMoves.length);
        const { piece, move } = untriedMoves.splice(idx, 1)[0];
        const result = applyMoveOnBoard(this.board, piece, move[0], move[1]);
        const child = new MCTSNode(result.board, this.team === 1 ? 2 : 1, this, move, piece);
        this.children.push(child);
        return child;
    }

    isFullyExpanded() { return this.getUntriedMoves().length === 0; }
    isTerminal() { return isGameOver(this.board).over; }
}

function mctsSimulate(board, currentTeam, maxMoves = 100) {
    let simBoard = cloneBoard(board);
    let team = currentTeam;
    for (let i = 0; i < maxMoves; i++) {
        const status = isGameOver(simBoard);
        if (status.over) return status.winner === 1 ? 1 : 0;
        const moves = getAllMovesForTeam(simBoard, team);
        if (moves.length === 0) return team === 1 ? 0 : 1;

        // Heuristic-guided rollout: prefer captures, then safe moves, then random
        let chosen;
        const captures = moves.filter(m => pieceKilledOnBoard(m.piece, m.move[0], m.move[1], simBoard) !== null);
        if (captures.length > 0) {
            chosen = captures[Math.floor(Math.random() * captures.length)];
        } else {
            const safeMoves = moves.filter(m => isSquareSafe(simBoard, m.move[0], m.move[1], team));
            if (safeMoves.length > 0 && Math.random() < 0.7) {
                chosen = safeMoves[Math.floor(Math.random() * safeMoves.length)];
            } else {
                chosen = moves[Math.floor(Math.random() * moves.length)];
            }
        }

        simBoard = applyMoveOnBoard(simBoard, chosen.piece, chosen.move[0], chosen.move[1]).board;
        team = team === 1 ? 2 : 1;
    }
    const score = evaluateBoard(simBoard);
    return score > 0 ? 1 : (score < 0 ? 0 : 0.5);
}

function mctsBackpropagate(node, result, rootTeam) {
    while (node !== null) {
        node.visits++;
        const nodeTeam = node.parent ? node.parent.team : rootTeam;
        node.wins += nodeTeam === 1 ? result : (1 - result);
        node = node.parent;
    }
}

function mctsAI(board, team, iterations = 1000) {
    const root = new MCTSNode(board, team);
    if (root.isTerminal()) return null;
    const moves = getAllMovesForTeam(board, team);
    if (moves.length === 0) return null;
    if (moves.length === 1) return { piece: moves[0].piece, move: moves[0].move };

    for (let i = 0; i < iterations; i++) {
        let node = root;
        while (!node.isTerminal() && node.isFullyExpanded() && node.children.length > 0) {
            node = node.selectChild();
        }
        if (!node.isTerminal() && !node.isFullyExpanded()) node = node.expand();
        let result;
        if (node && !node.isTerminal()) result = mctsSimulate(node.board, node.team);
        else if (node) result = isGameOver(node.board).winner === 1 ? 1 : 0;
        else continue;
        mctsBackpropagate(node, result, team);
    }

    let bestChild = null;
    let bestVisits = -1;
    for (let child of root.children) {
        if (child.visits > bestVisits) { bestVisits = child.visits; bestChild = child; }
    }
    if (bestChild) {
        const originalPiece = board.pieces.find(p => p.id === bestChild.piece.id);
        return { piece: originalPiece, move: bestChild.move };
    }
    return null;
}

// ============================================
// Positional AI - "Patient Strategist"
// ============================================

function positionalAI(board, team) {
    const opponent = team === 1 ? 2 : 1;
    const moves = getAllMovesForTeam(board, team);
    if (moves.length === 0) return null;

    let allMoves = [];
    for (let { piece, move } of moves) {
        const result = applyMoveOnBoard(board, piece, move[0], move[1]);
        const isCapture = pieceKilledOnBoard(piece, move[0], move[1], board) !== null;
        let score = 0;

        // 1. Piece cohesion: reward friendly neighbors after move
        const myPieces = result.board.pieces.filter(p => p.team === team);
        let cohesion = 0;
        for (let p of myPieces) {
            for (let other of myPieces) {
                if (p.id === other.id) continue;
                if (Math.abs(p.x - other.x) <= 1 && Math.abs(p.y - other.y) <= 1) {
                    cohesion++;
                }
            }
        }
        score += cohesion * 25;

        // 2. Center control: prefer central squares
        const centerX = 4 - Math.abs(3.5 - move[0]);
        const centerY = 4 - Math.abs(3.5 - move[1]);
        score += (centerX + centerY) * 15;

        // 3. Structured advancement: reward advancing as a group, not solo
        const avgY = myPieces.reduce((s, p) => s + (team === 1 ? p.y : 7 - p.y), 0) / myPieces.length;
        const myAdvancement = team === 1 ? move[1] : 7 - move[1];
        const deviation = Math.abs(myAdvancement - avgY);
        score += avgY * 10;
        score -= deviation * 20;

        // 4. Back rank integrity: penalize vacating back rank early
        const backRank = team === 1 ? 0 : 7;
        const backRankPieces = myPieces.filter(p => p.y === backRank).length;
        if (piece.y === backRank && move[1] !== backRank && backRankPieces <= 2) {
            score -= 80;
        }

        // 5. Opponent mobility restriction
        const oppMoves = getAllMovesForTeam(result.board, opponent);
        score -= oppMoves.length * 8;

        // 6. Safety: destination + count ALL exposed friendly pieces
        const safe = isSquareSafe(result.board, move[0], move[1], team);
        score += safe ? 60 : -120;

        let exposedPieces = 0;
        for (let p of myPieces) {
            if (!isSquareSafe(result.board, p.x, p.y, team)) exposedPieces++;
        }
        score -= exposedPieces * 60;

        // 7. Captures: take them even at some risk — patient but not passive
        if (isCapture && safe) score += 150;
        else if (isCapture && !safe) score += 20;

        score += aiNoise();
        allMoves.push({ piece, move, score });
    }

    allMoves.sort((a, b) => b.score - a.score);
    const maxScore = allMoves[0].score;
    const bestMoves = allMoves.filter(m => m.score >= maxScore - 30);
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// ============================================
// AI move dispatcher
// ============================================

function getAIMove(playerType, team) {
    const dispatch = {
        [PLAYER_RANDOM]: randomAI,
        [PLAYER_GREEDY]: greedyAI,
        [PLAYER_SUPER_GREEDY]: superGreedyAI,
        [PLAYER_DEFENSIVE]: defensiveAI,
        [PLAYER_ADAPTIVE]: adaptiveAI,
        [PLAYER_MINIMAX]: minimaxAI,
        [PLAYER_MCTS]: mctsAI,
        [PLAYER_POSITIONAL]: positionalAI
    };
    const fn = dispatch[playerType];
    const result = fn ? fn(game.board, team) : null;
    if (!result) return null;

    // Enforce mandatory capture for heuristic AIs that enumerate per-piece
    const isCapture = pieceKilledOnBoard(result.piece, result.move[0], result.move[1], game.board) !== null;
    if (!isCapture) {
        const captures = getAllMovesForTeam(game.board, team);
        if (captures.length > 0 && pieceKilledOnBoard(captures[0].piece, captures[0].move[0], captures[0].move[1], game.board) !== null) {
            return captures[Math.floor(Math.random() * captures.length)];
        }
    }
    return result;
}
