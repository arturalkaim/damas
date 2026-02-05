/**
 * This is a p5.js sketch that implements the game of checkers.
 *
 * Features multiple AI algorithms:
 * - Greedy AI: Original algorithm that prioritizes captures
 * - Minimax AI: Look-ahead algorithm with alpha-beta pruning
 */

const WIDTH = 600;
const HEIGHT = 680; // Increased for UI controls


const boardWidth = 400;
const boardHeight = 400;
const boardX = (WIDTH - boardWidth) / 2;
const boardY = (HEIGHT - boardHeight) / 2;
const squareWidth = boardWidth / 8;
const squareHeight = boardHeight / 8;

let playerTurn = 1;

const player1Color = [55, 110, 60];
const player2Color = [200, 200, 55];

function drawBoard() {
    // Draw the board in the center of the canvas
    fill(255, 255, 255);
    rect(boardX, boardY, boardWidth, boardHeight);

    // Draw the squares
    for (let i = 0; i < 8; i++) {
        let y = boardY + i * squareHeight;
        for (let j = 0; j < 8; j++) {
            let x = boardX + j * squareWidth;
            if ((i + j) % 2 == 0) {
                fill(245, 255, 245);
            } else {
                fill(200, 210, 200);
            }
            rect(x, y, squareWidth, squareHeight);
        }
    }
    //draw row and column labels
    fill(0, 0, 0);
    textSize(20);
    for (let i = 0; i < 8; i++) {
        let x = boardX + i * squareWidth;
        let y = boardY - 10;
        text(i, x + squareWidth / 2, y);
    }

    for (let i = 0; i < 8; i++) {
        let x = boardX - 20;
        let y = boardY + i * squareHeight;
        text(i, x, y + squareHeight / 2);
    }
}


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
        // draw the piece
        let x = boardX + this.x * squareWidth;
        let y = boardY + this.y * squareHeight;
        noStroke();
        if (this.team == 1) {
            fill(player1Color[0], player1Color[1], player1Color[2])
        }
        else {
            fill(player2Color[0], player2Color[1], player2Color[2])
        }
        ellipse(x + squareWidth / 2, y + squareHeight / 2, squareWidth * 0.8, squareHeight * 0.8);
        if (this.king) {
            fill(255, 255, 255);
            textSize(20);
            text("K", x + squareWidth * 0.4, y + squareHeight * 0.6);
        }
    }
}

class Board {
    constructor(pieces) {
        this.pieces = pieces;
    }

    draw() {
        drawBoard();
        for (let i = 0; i < this.pieces.length; i++) {
            this.pieces[i].draw();
        }
    }
}

class Game {
    constructor(board) {
        this.board = board;
    }

    draw() {
        if (this.board != null)
            this.board.draw();
        // Player turn indicator is now drawn in drawPlayerTypes()
    }
}

class Player {
    constructor(id, team) {
        this.id = id;
        this.team = team;
    }
}

// ============================================
// AI ALGORITHMS
// ============================================

// Player type constants
const PLAYER_HUMAN = 'human';
const PLAYER_GREEDY = 'greedy';
const PLAYER_MINIMAX = 'minimax';

// Player type configuration
let player1Type = PLAYER_HUMAN;
let player2Type = PLAYER_HUMAN;

// AI delay for visualization (ms)
const AI_MOVE_DELAY = 500;
let aiMoveScheduled = false;

/**
 * Clone the board state for simulation
 */
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

/**
 * Find available moves for a piece on a given board state
 */
function findAvailableMovesOnBoard(piece, board) {
    let moves = [];
    let x = piece.x0;
    let y = piece.y0;

    const directions = [
        [1, -1], [2, -2],   // NE
        [-1, -1], [-2, -2], // NW
        [1, 1], [2, 2],     // SE
        [-1, 1], [-2, 2]    // SW
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

/**
 * Validate a jump on a given board state
 */
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

/**
 * Check if a move results in a capture on a given board
 */
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

/**
 * Apply a move on a cloned board and return new board state
 */
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

    // King promotion
    if (newPiece.team === 1 && newPiece.y === 7) newPiece.king = true;
    if (newPiece.team === 2 && newPiece.y === 0) newPiece.king = true;

    return { board: newBoard, captured: killed !== null };
}

/**
 * Get all possible moves for a team on a board
 */
function getAllMovesForTeam(board, team) {
    const moves = [];
    const pieces = board.pieces.filter(p => p.team === team);

    for (let piece of pieces) {
        const pieceMoves = findAvailableMovesOnBoard(piece, board);
        for (let move of pieceMoves) {
            moves.push({ piece: piece, move: move });
        }
    }

    return moves;
}

/**
 * Evaluate board state for minimax
 * Positive = good for team 1, Negative = good for team 2
 */
function evaluateBoard(board) {
    let score = 0;

    for (let piece of board.pieces) {
        let pieceValue = 10; // Base piece value

        // King bonus
        if (piece.king) pieceValue += 5;

        // Advancement bonus (closer to promotion)
        if (!piece.king) {
            if (piece.team === 1) {
                pieceValue += piece.y * 0.5; // Team 1 advances down
            } else {
                pieceValue += (7 - piece.y) * 0.5; // Team 2 advances up
            }
        }

        // Center control bonus
        const centerX = Math.abs(3.5 - piece.x);
        const centerY = Math.abs(3.5 - piece.y);
        pieceValue += (4 - centerX - centerY) * 0.3;

        // Add or subtract based on team
        if (piece.team === 1) {
            score += pieceValue;
        } else {
            score -= pieceValue;
        }
    }

    return score;
}

/**
 * Check if game is over on a board state
 */
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

/**
 * Minimax algorithm with alpha-beta pruning
 */
function minimax(board, depth, alpha, beta, maximizingPlayer, currentTeam) {
    const gameStatus = isGameOver(board);

    if (gameStatus.over) {
        // Return large value for wins
        return gameStatus.winner === 1 ? 1000 : -1000;
    }

    if (depth === 0) {
        return evaluateBoard(board);
    }

    const moves = getAllMovesForTeam(board, currentTeam);

    if (maximizingPlayer) {
        let maxEval = -Infinity;
        for (let { piece, move } of moves) {
            const result = applyMoveOnBoard(board, piece, move[0], move[1]);
            const nextTeam = currentTeam === 1 ? 2 : 1;
            const evalScore = minimax(result.board, depth - 1, alpha, beta, false, nextTeam);
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break; // Alpha-beta pruning
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let { piece, move } of moves) {
            const result = applyMoveOnBoard(board, piece, move[0], move[1]);
            const nextTeam = currentTeam === 1 ? 2 : 1;
            const evalScore = minimax(result.board, depth - 1, alpha, beta, true, nextTeam);
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break; // Alpha-beta pruning
        }
        return minEval;
    }
}

/**
 * GREEDY AI - Original algorithm
 * Prioritizes captures, random selection among equals
 */
function greedyAI(board, team) {
    const pieces = board.pieces.filter(p => p.team === team);
    let allMoves = [];

    for (let piece of pieces) {
        const moves = findAvailableMovesOnBoard(piece, board);
        for (let move of moves) {
            const length = Math.abs(piece.x0 - move[0]);
            allMoves.push({ piece: piece, move: move, length: length });
        }
    }

    if (allMoves.length === 0) return null;

    // Sort by length (longer = capture)
    allMoves.sort((a, b) => b.length - a.length);

    // Filter to best moves
    const maxLength = allMoves[0].length;
    const bestMoves = allMoves.filter(m => m.length === maxLength);

    // Random selection among equally good moves
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

/**
 * MINIMAX AI - Look-ahead algorithm
 * Uses minimax with alpha-beta pruning
 */
function minimaxAI(board, team, depth = 4) {
    const moves = getAllMovesForTeam(board, team);

    if (moves.length === 0) return null;

    let bestMove = null;
    let bestScore = team === 1 ? -Infinity : Infinity;

    for (let { piece, move } of moves) {
        const result = applyMoveOnBoard(board, piece, move[0], move[1]);
        const nextTeam = team === 1 ? 2 : 1;
        const isMaximizing = team !== 1; // Next player's perspective
        const score = minimax(result.board, depth - 1, -Infinity, Infinity, isMaximizing, nextTeam);

        if (team === 1) {
            if (score > bestScore) {
                bestScore = score;
                bestMove = { piece: piece, move: move };
            }
        } else {
            if (score < bestScore) {
                bestScore = score;
                bestMove = { piece: piece, move: move };
            }
        }
    }

    console.log(`Minimax chose move with score: ${bestScore}`);
    return bestMove;
}

/**
 * Get AI move based on player type
 */
function getAIMove(playerType, team) {
    if (playerType === PLAYER_GREEDY) {
        return greedyAI(game.board, team);
    } else if (playerType === PLAYER_MINIMAX) {
        return minimaxAI(game.board, team);
    }
    return null;
}

/**
 * Schedule AI move with delay for visualization
 */
function scheduleAIMove() {
    if (aiMoveScheduled) return;

    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;

    if (currentPlayerType === PLAYER_HUMAN) return;

    aiMoveScheduled = true;

    setTimeout(() => {
        executeAIMove();
        aiMoveScheduled = false;
    }, AI_MOVE_DELAY);
}

/**
 * Execute AI move
 */
function executeAIMove() {
    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;

    // Handle chain captures
    if (pieceSelected !== null) {
        const chainMove = canKillMore(pieceSelected);
        if (chainMove) {
            movePiece(pieceSelected, chainMove[0], chainMove[1]);
            checkGameOver();
            return;
        }
    }

    const result = getAIMove(currentPlayerType, playerTurn);

    if (result === null) {
        const winner = playerTurn === 1 ? 2 : 1;
        setTimeout(() => alert(`Player ${winner} wins!`), 100);
        return;
    }

    // Find actual piece in game board
    const piece = game.board.pieces.find(p => p.id === result.piece.id);
    if (piece) {
        pieceSelected = piece;
        piece.x0 = piece.x;
        piece.y0 = piece.y;
        movePiece(piece, result.move[0], result.move[1]);
        checkGameOver();
    }
}

/**
 * Check if game is over and show result
 */
function checkGameOver() {
    if (game.board.pieces.filter(p => p.team === 1).length === 0) {
        setTimeout(() => alert("Player 2 wins!"), 100);
        return true;
    }
    if (game.board.pieces.filter(p => p.team === 2).length === 0) {
        setTimeout(() => alert("Player 1 wins!"), 100);
        return true;
    }
    return false;
}

// ============================================
// END AI ALGORITHMS
// ============================================

// create the players
let player1 = new Player(1, 1);
let player2 = new Player(2, 2);
console.log(player1);

let game = new Game();

function resetGame() {
    aiMoveScheduled = false;
    pieceSelected = null;
    setupGame();
}

function setupGame() {
    // create the pieces and put them in an array
    // the pieces are numbered from 0 to 11 for player 1 and from 12 to 23 for player 2
    // the pieces are placed in the first 3 rows of the board for each player in alternating squares

    let pieces = [];

    let pieceId = 0;
    for (let i = 0; i < 4; i++) {
        let x = i * 2;
        let y = 0;
        let piece = new Piece(pieceId++, x, y, 1);
        pieces.push(piece);
    }

    for (let i = 0; i < 4; i++) {
        let x = i * 2 + 1;
        let y = 1;
        let piece = new Piece(pieceId++, x, y, 1);
        pieces.push(piece);
    }

    for (let i = 0; i < 4; i++) {
        let x = i * 2;
        let y = 2;
        let piece = new Piece(pieceId++, x, y, 1);
        pieces.push(piece);
    }


    for (let i = 0; i < 4; i++) {
        let x = i * 2 + 1;
        let y = 5;
        let piece = new Piece(pieceId++, x, y, 2);
        pieces.push(piece);
    }

    for (let i = 0; i < 4; i++) {
        let x = i * 2;
        let y = 6;
        let piece = new Piece(pieceId++, x, y, 2);
        pieces.push(piece);
    }

    for (let i = 0; i < 4; i++) {
        let x = i * 2 + 1;
        let y = 7;
        let piece = new Piece(pieceId++, x, y, 2);
        pieces.push(piece);
    }


    console.log(pieces);

    // create the board
    let board = new Board(pieces);
    console.log(board);

    // create the game
    game = new Game(board);
    console.log(game);

    playerTurn = 1;

}


let pieceSelected = null;

function findAvailableMoves(piece) {
    // find the available moves for the piece
    let moves = [];
    let x = piece.x0;
    let y = piece.y0;

    // check NE moves - one and two squares
    if (validJump(piece, x + 1, y - 1))
        moves.push([x + 1, y - 1]);

    if (validJump(piece, x + 2, y - 2))
        moves.push([x + 2, y - 2]);

    // check NW moves - one and two squares
    if (validJump(piece, x - 1, y - 1))
        moves.push([x - 1, y - 1]);

    if (validJump(piece, x - 2, y - 2))
        moves.push([x - 2, y - 2]);

    // check SE moves - one and two squares
    if (validJump(piece, x + 1, y + 1))
        moves.push([x + 1, y + 1]);

    if (validJump(piece, x + 2, y + 2))
        moves.push([x + 2, y + 2]);

    // check SW moves - one and two squares
    if (validJump(piece, x - 1, y + 1))
        moves.push([x - 1, y + 1]);

    if (validJump(piece, x - 2, y + 2))
        moves.push([x - 2, y + 2]);

    // check if the piece is a king
    if (!piece.king)
        return moves;

    // check if the piece is a king and add the moves for the king




    for (let xi = -7; xi < 8; xi++) {
        if (validJump(piece, x + xi, y + xi))
            moves.push([x + xi, y + xi]);
    }

    for (let yi = -7; yi < 8; yi++) {
        if (validJump(piece, x + yi, y - yi))
            moves.push([x + yi, y - yi]);
    }



    return moves;
}



function mouseDragged() {
    // Only allow human control when it's a human player's turn
    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;
    if (currentPlayerType !== PLAYER_HUMAN) return;

    if (pieceSelected != null) {
        pieceSelected.x = Math.floor((mouseX - boardX) / squareWidth);
        pieceSelected.y = Math.floor((mouseY - boardY) / squareHeight);
    }
}

function validJump(piece, x, y) {

    // check if the piece is out of bounds
    if (x < 0 || x > 7 || y < 0 || y > 7) {
        // console.log("out of bounds");
        return false;
    }

    // check if jump is diagonal
    if (Math.abs(piece.x0 - x) != Math.abs(piece.y0 - y)) {
        // console.log("not diagonal", piece.x0, piece.y0, x, y);
        return false;
    }

    // check if the piece is not on the same square
    if (piece.x0 == x && piece.y0 == y) {
        // console.log("same square", piece.x0, piece.y0, x, y);
        return false;
    }

    // check if the piece jumped more than 2 squares
    if (Math.abs(piece.x0 - x) > 2 && !piece.king) {
        // console.log("not 2 squares", piece.x0, piece.y0, x, y, Math.abs(piece.x0 - x));
        return false;
    }

    // check if the piece jumped to an empty square
    let otherPiece = game.board.pieces.find(p => p.x == x && p.y == y && p.id != piece.id);
    if (otherPiece != null) {
        // console.log("piece in the way", otherPiece.x, otherPiece.y);
        return false
    }

    // check if the piece jumped over another piece from the same team
    otherPiece = game.board.pieces.find(p => p.x == (piece.x0 + x) / 2 && p.y == (piece.y0 + y) / 2 && p.team == piece.team);
    if (otherPiece != null) {
        return false;
    }

    // check if the piece jumped over another piece from the other team
    // if the jump is 2 squares, then there must be a piece in the middle of the other team
    if (Math.abs(piece.x0 - x) == 2 && !piece.king) {
        otherPiece = game.board.pieces.find(p => p.x == (piece.x0 + x) / 2 && p.y == (piece.y0 + y) / 2 && p.team != piece.team);
        if (otherPiece == null) {
            return false;
        }
    }


    return true;
}

function piceKilled(piece, x, y) {
    // check if there's a piece in the middle
    // first check if the jump is more than 1 square
    if (Math.abs(piece.x0 - x) > 1) {
        // check if there's any piece between the start and end
        const startx = Math.min(piece.x0, x);
        const endx = Math.max(piece.x0, x);
        const starty = Math.min(piece.y0, y);
        const endy = Math.max(piece.y0, y);
        for (let xi = startx + 1, yi = starty + 1; xi < endx && yi < endy; xi++, yi++) {
            let otherPiece = game.board.pieces.find(p => p.x == xi && p.y == yi && p.team != piece.team);
            return otherPiece;
        }
    }
    return false;
}

function canKillMore(piece) {
    // check if the piece can kill more pieces
    // first find the available moves
    // after checking if any available moves jump over a piece from the other team
    let moves = findAvailableMoves(piece);
    for (let i = 0; i < moves.length; i++) {
        if (piceKilled(piece, moves[i][0], moves[i][1])) {
            return moves[i];
        }
    }
}

function movePiece(piece, x, y) {

    if (validJump(piece, x, y)) {
        // move the selected piece to that position
        piece.x = x;
        piece.y = y;

        // check if the piece is now a king
        // if (piece.team == 1 && piece.y == 7) {
        //     piece.king = true;
        // }
        // if (piece.team == 2 && piece.y == 0) {
        //     piece.king = true;
        // }

        // if the piece is in a valid position, check if there is a piece in that position
        const killed = piceKilled(piece, x, y)

        piece.x0 = x;
        piece.y0 = y;

        if (killed) {

            // if there is a piece in that position, remove it from the board
            game.board.pieces = game.board.pieces.filter(p => p.id != killed.id);
            // check if the piece can kill more pieces
            if (!canKillMore(piece)) {
                // change the turn
                playerTurn = playerTurn == 1 ? 2 : 1;
                pieceSelected = null;
            }
        } else {
            // change the turn
            playerTurn = playerTurn == 1 ? 2 : 1;
            pieceSelected = null;
        }
    }
    else {
        // if the piece is not in a valid position, return it to its original position
        piece.x = piece.x0;
        piece.y = piece.y0;
    }


}


function findBestMove(piece, moves) {
    // find the best move

    const sortedMoves = moves.map(m => {
        const length = Math.abs(piece.x0 - m[0]);
        return {
            move: m,
            length: length
        }
    }).sort((a, b) => b.length - a.length);

    console.log("sortedMoves", sortedMoves);

    return sortedMoves[0];
}



function autoPlay() {

    let piece = null;
    let move = null;

    if (pieceSelected == null) {
        // find all the pieces from current player
        let pieces = game.board.pieces.filter(p => p.team == playerTurn);
        // find all the available moves for each piece
        let moves = [];
        for (let i = 0; i < pieces.length; i++) {
            let pieceMoves = findAvailableMoves(pieces[i])
            console.log("findAvailableMoves", pieceMoves);
            if (pieceMoves.length > 0) {
                let bestMove = findBestMove(pieces[i], pieceMoves);
                moves.push({ piece: pieces[i], move: bestMove.move, length: bestMove.length, allMoves: pieceMoves });
            }
        }

        console.log("moves", moves);

        // if there are no available moves, the other player wins
        if (moves.length == 0) {
            alert("Player " + (playerTurn == 1 ? 2 : 1) + " wins");
            return;
        }

        const sortedMoves = [...moves].sort((a, b) => b.length - a.length);
        // find the piece with the best move
        // a move is better if it's longer
        // if more than one has the max length, pick a random one
        const maxLength = sortedMoves[0].length
        const bestMoves = sortedMoves.filter(m => m.length == maxLength);
        const pieceAndMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];

        console.log("sorted moves", sortedMoves);

        piece = pieceAndMove.piece;
        move = pieceAndMove.move;

        if (!piece || !move) {
            alert("Player " + (playerTurn == 1 ? 2 : 1) + " wins");
            return;
        }
        pieceSelected = piece;
    } else {
        piece = pieceSelected;
        move = canKillMore(pieceSelected);
        if (!move) {
            alert("Player " + (playerTurn == 1 ? 2 : 1) + " wins");
            return;
        }
    }

    // move the piece
    movePiece(piece, move[0], move[1]);
}

function mouseReleased() {
    // Only allow human control when it's a human player's turn
    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;
    if (currentPlayerType !== PLAYER_HUMAN) return;

    if (pieceSelected != null) {
        let x = Math.floor((mouseX - boardX) / squareWidth);
        let y = Math.floor((mouseY - boardY) / squareHeight);

        // check if the piece is in a valid position
        movePiece(pieceSelected, x, y);
    }

    // check if game is over
    checkGameOver();
}

function mousePressed() {
    // Only allow human control when it's a human player's turn
    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;
    if (currentPlayerType !== PLAYER_HUMAN) return;

    // check if the mouse is inside the board
    if (mouseX < boardX || mouseX > boardX + boardWidth ||
        mouseY < boardY || mouseY > boardY + boardHeight) {
        return;
    }

    // check if the mouse is inside the board
    let x = Math.floor((mouseX - boardX) / squareWidth);
    let y = Math.floor((mouseY - boardY) / squareHeight);
    console.log(x, y, boardX, boardY);


    // check if there is a piece in the square
    for (let i = 0; i < game.board.pieces.length; i++) {
        if (game.board.pieces[i].x == x && game.board.pieces[i].y == y && game.board.pieces[i].team == playerTurn) {
            pieceSelected = game.board.pieces[i];
            pieceSelected.x0 = pieceSelected.x;
            pieceSelected.y0 = pieceSelected.y;
            break;
        }
    }
}

function mouseMoved() {
    // Only show grab cursor for human players
    const currentPlayerType = playerTurn === 1 ? player1Type : player2Type;
    if (currentPlayerType !== PLAYER_HUMAN) {
        cursor('default');
        return;
    }

    // if the mouse is over a piece of the current player, change the cursor
    let x = Math.floor((mouseX - boardX) / squareWidth);
    let y = Math.floor((mouseY - boardY) / squareHeight);

    let piece = game.board.pieces.find(p => p.x == x && p.y == y && p.team == playerTurn);
    if (piece != null) {
        cursor('grab');
    } else {
        cursor('default');
    }
}

function drawAvailableMoves() {
    if (pieceSelected != null) {
        let moves = findAvailableMoves(pieceSelected);
        for (let i = 0; i < moves.length; i++) {
            let x = moves[i][0];
            let y = moves[i][1];
            fill(255, 255, 0, 100);
            rect(boardX + x * squareWidth, boardY + y * squareHeight, squareWidth, squareHeight);
        }
    }
}


// UI Elements
let player1Select, player2Select;

function setup() {
    // create canvas in the center of the screen
    createCanvas(WIDTH, HEIGHT);

    // Player 1 selector
    let label1 = createSpan('Player 1 (Green):');
    label1.position(20, 615);
    label1.style('color', 'rgb(55, 110, 60)');
    label1.style('font-weight', 'bold');

    player1Select = createSelect();
    player1Select.position(140, 612);
    player1Select.option('Human', PLAYER_HUMAN);
    player1Select.option('Greedy AI', PLAYER_GREEDY);
    player1Select.option('Minimax AI', PLAYER_MINIMAX);
    player1Select.changed(() => {
        player1Type = player1Select.value();
        console.log('Player 1 type:', player1Type);
    });

    // Player 2 selector
    let label2 = createSpan('Player 2 (Yellow):');
    label2.position(320, 615);
    label2.style('color', 'rgb(180, 180, 50)');
    label2.style('font-weight', 'bold');

    player2Select = createSelect();
    player2Select.position(445, 612);
    player2Select.option('Human', PLAYER_HUMAN);
    player2Select.option('Greedy AI', PLAYER_GREEDY);
    player2Select.option('Minimax AI', PLAYER_MINIMAX);
    player2Select.changed(() => {
        player2Type = player2Select.value();
        console.log('Player 2 type:', player2Type);
    });

    // create a button to reset the game
    let resetButton = createButton('Reset');
    resetButton.position(530, 650);
    resetButton.mousePressed(resetGame);

    // create a button for single auto play step (legacy)
    let playButton = createButton('Auto Step');
    playButton.position(440, 650);
    playButton.mousePressed(autoPlay);

    setupGame();

}


function draw() {
    background(150, 180, 150)
    game.draw();

    drawAvailableMoves();
    drawPlayerTypes();

    // Trigger AI move if current player is AI
    scheduleAIMove();
}

function drawPlayerTypes() {
    // Draw player type indicators
    textSize(14);

    // Player 1 type
    fill(55, 110, 60);
    const p1TypeLabel = player1Type === PLAYER_HUMAN ? '(Human)' :
                        player1Type === PLAYER_GREEDY ? '(Greedy AI)' : '(Minimax AI)';

    // Player 2 type
    fill(180, 180, 50);
    const p2TypeLabel = player2Type === PLAYER_HUMAN ? '(Human)' :
                        player2Type === PLAYER_GREEDY ? '(Greedy AI)' : '(Minimax AI)';

    // Show current player indicator with type
    textSize(16);
    if (playerTurn === 1) {
        fill(55, 110, 60);
        text(`▶ Player 1's turn ${p1TypeLabel}`, 10, 30);
        fill(150, 150, 150);
        text(`  Player 2 ${p2TypeLabel}`, 10, 55);
    } else {
        fill(150, 150, 150);
        text(`  Player 1 ${p1TypeLabel}`, 10, 30);
        fill(180, 180, 50);
        text(`▶ Player 2's turn ${p2TypeLabel}`, 10, 55);
    }
}