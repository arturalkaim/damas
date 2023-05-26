/**
 * This is a p5.js sketch that implements the game of checkers.
 */

const WIDTH = 600;
const HEIGHT = 600;


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

        // draw the player turn text in the player color
        if (this.team == 1) {
            fill(player1Color[0], player1Color[1], player1Color[2])
        }
        else {
            fill(player2Color[0], player2Color[1], player2Color[2])
        }
        textSize(20);
        text("Player " + playerTurn + "'s turn", 10, 20);
    }
}

class Player {
    constructor(id, team) {
        this.id = id;
        this.team = team;
    }
}

// create the players
let player1 = new Player(1, 1);
let player2 = new Player(2, 2);
console.log(player1);

let game = new Game();

function resetGame() {
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
    if (pieceSelected != null) {
        let x = Math.floor((mouseX - boardX) / squareWidth);
        let y = Math.floor((mouseY - boardY) / squareHeight);

        // check if the piece is in a valid position
        movePiece(pieceSelected, x, y);
    }

    // check if game is over
    // shows alert with the winner and reset the game

    if (game.board.pieces.filter(p => p.team == 1).length == 0) {
        alert("Player 2 wins");
    }
    if (game.board.pieces.filter(p => p.team == 2).length == 0) {
        alert("Player 1 wins");
    }
}

function mousePressed() {

    // check if the mouse is inside the canvas
    if (mouseX < 100 || mouseX > 500 || mouseY < 100 || mouseY > 500) {
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


function setup() {
    // create canvas in the center of the screen
    createCanvas(WIDTH, HEIGHT);


    // create a button to reset the game
    let resetButton = createButton('Reset');
    resetButton.position(510, 610);
    resetButton.mousePressed(resetGame);

    // create a button to reset the game
    let playButton = createButton('Auto Play');
    playButton.position(410, 610);
    playButton.mousePressed(autoPlay);

    setupGame();

}


function draw() {
    background(150, 180, 150)
    game.draw();

    drawAvailableMoves();
}