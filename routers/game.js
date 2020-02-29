const { Router } = require("express");
const authMiddleware = require("../auth/middleware");
const { room, user, game } = require("../models");

const lettersQuantity = [
  "*-3",
  "а-10",
  "б-3",
  "в-5",
  "г-3",
  "д-5",
  "е-9",
  "ж-2",
  "з-2",
  "и-8",
  "й-4",
  "к-6",
  "л-4",
  "м-5",
  "н-8",
  "о-10",
  "п-6",
  "р-6",
  "с-6",
  "т-5",
  "у-3",
  "ф-1",
  "х-2",
  "ц-1",
  "ч-2",
  "ш-1",
  "щ-1",
  "ъ-1",
  "ы-2",
  "ь-2",
  "э-1",
  "ю-1",
  "я-3"
];
const lettersValue = [
  "*-0",
  "а-1",
  "б-3",
  "в-2",
  "г-3",
  "д-2",
  "е-1",
  "ж-5",
  "з-5",
  "и-1",
  "й-2",
  "к-2",
  "л-2",
  "м-2",
  "н-1",
  "о-1",
  "п-2",
  "р-2",
  "с-2",
  "т-2",
  "у-3",
  "ф-10",
  "х-5",
  "ц-10",
  "ч-5",
  "ш-10",
  "щ-10",
  "ъ-10",
  "ы-5",
  "ь-5",
  "э-10",
  "ю-10",
  "я-3"
];

function createLetterArray(qty) {
  const qtyArray = qty.split("-");
  return Array(parseInt(qtyArray[1])).fill(qtyArray[0]);
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

const originalLetters = lettersQuantity.reduce((acc, char, index) => {
  return acc.concat(createLetterArray(char));
}, []);

function factory(stream) {
  const router = new Router();

  router.post("/start", authMiddleware, async (req, res, nxt) => {
    roomId = req.body.roomId;
    try {
      const currentRoom = await room.findByPk(roomId, {
        include: [
          {
            model: user,
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          },
          game
        ]
      });

      const turnOrder = shuffle(currentRoom.users.map(user => user.id));
      const turn = turnOrder[0];

      // give letters to players
      const lettersForGame = shuffle(originalLetters);
      const acc = { pot: lettersForGame.slice(7 * currentRoom.users.length) };
      const letters = currentRoom.users.reduce((acc, user, index) => {
        acc[user.id] = lettersForGame.slice(0 + index * 7, 7 + index * 7);
        return acc;
      }, acc);
      const score = currentRoom.users.reduce((acc, user) => {
        acc[user.id] = 0;
        return acc;
      }, {});
      const currentGame = await game.create({
        turnOrder,
        turn,
        letters,
        roomId,
        score
      });
      await currentGame.setUsers(currentRoom.users);
      await currentRoom.update({ phase: "started" });
      const action = {
        type: "GAME_UPDATED",
        payload: { gameId: currentGame.id, currentGame }
      };
      const string = JSON.stringify(action);
      stream.send(string);
      res.send(currentGame);
      const updatedRoom = await room.findByPk(currentRoom.id, {
        include: [
          {
            model: user,
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          },
          { model: game }
        ]
      });
      const action2 = {
        type: "UPDATED_ROOMS",
        payload: { newRoom: updatedRoom }
      };
      const string2 = JSON.stringify(action2);
      stream.send(string2); // later change to different stream
    } catch (error) {
      nxt(error);
    }
  });

  router.get("/game/:id", async (req, res, next) => {
    const gameId = req.params.id;
    try {
      const currentGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          }
        ]
      });
      const action = {
        type: "GAME_UPDATED",
        payload: { gameId, currentGame }
      };
      const string = JSON.stringify(action);
      stream.send(string);
    } catch (error) {
      next(error);
    }
  });

  //turn of the game
  router.post("/game/:id/turn", authMiddleware, async (req, res, next) => {
    console.log("post turn");
    // get user from authmiddleware
    const user = req.user;
    const gameId = req.params.id;
    const userBoard = req.body.userBoard;
    // check if game is in turn phase
    const currentGame = await game.findByPk(gameId);
    if (currentGame.phase !== "turn") {
      return next("Wrong game phase");
    }
    // check if this is user's turn
    if (currentGame.turn !== user.id) {
      return next(`It is not turn of user ${user.id}`);
    }
    // check if all letters in turn were i user's hand
    if (
      userBoard.some(row =>
        row.some(
          letter =>
            letter !== null && !currentGame.letters[user.id].includes(letter)
        )
      )
    ) {
      return next(`Invalid letters used`);
    }
    // check if all letters are placed on empty cells
    if (
      userBoard.some((row, y) =>
        row.some(
          (letter, x) => letter !== null && currentGame.board[y][x] !== null
        )
      )
    ) {
      return next("Cell is already occupied");
    }
    // add user letters to current board
    const newBoard = currentGame.board.map((row, y) =>
      row.map((cell, x) => {
        if (cell === null && userBoard[y][x] !== null) {
          return userBoard[y][x];
        } else {
          return cell;
        }
      })
    );
    // copy game board to previous board
    // change game phase to validation
    await currentGame.update({
      previousBoard: currentGame.board,
      board: newBoard,
      phase: "validation"
    });
    // remove those letters from user hand
    // fetch game from db
    const updatedGame = await game.findByPk(gameId, {
      include: [
        {
          model: user,
          attributes: {
            exclude: ["password", "createdAt", "updatedAt", "roomId"]
          }
        }
      ]
    });

    // send action to client
    const action = {
      type: "GAME_UPDATED",
      payload: { gameId, updatedGame }
    };
    const string = JSON.stringify(action);
    stream.send(string);
  });

  return router;
}

module.exports = factory;
