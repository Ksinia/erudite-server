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

function getNextTurn(game) {
  return (game.turn + 1) % game.turnOrder.length;
}

function updateGameLetters(game) {
  const currentUserId = game.turnOrder[game.turn];
  const currentUserLetters = game.letters[currentUserId];
  let requiredQty = 7 - currentUserLetters.length;
  if (game.letters.pot.length < requiredQty) {
    requiredQty = game.letters.pot.length;
  }
  const updatedUserLetters = currentUserLetters.concat(
    game.letters.pot.slice(0, requiredQty)
  );
  const updatedPot = game.letters.pot.slice(requiredQty);
  const updatedGameLetters = {
    ...game.letters,
    [currentUserId]: updatedUserLetters,
    pot: updatedPot
  };
  return updatedGameLetters;
}

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
      res.send(updatedRoom);
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
            as: "users",
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          }
        ]
      });
      const action = {
        type: "GAME_UPDATED",
        payload: { gameId: gameId, game: currentGame }
      };
      const string = JSON.stringify(action);
      res.send(currentGame);
      stream.send(string);
    } catch (error) {
      next(error);
    }
  });

  //turn of the game
  router.post("/game/:id/turn", authMiddleware, async (req, res, next) => {
    // get user from authmiddleware
    const currentUser = req.user;
    console.log(currentUser.id, "currentUser.id");
    const gameId = req.params.id;
    const userBoard = req.body.userBoard;
    try {
      // check if game is in turn phase
      const currentGame = await game.findByPk(gameId);
      if (currentGame.phase !== "turn") {
        return next(`Wrong game phase: ${currentGame.phase}`);
      }
      // check if this is user's turn
      if (currentGame.turnOrder[currentGame.turn] !== currentUser.id) {
        return next(`It is not turn of user ${currentUser.id}`);
      }
      // check if user passed
      if (!userBoard.some(row => row.some(letter => letter))) {
        // copy game board to previous board
        // change game phase to next turn, no need to validate pass
        // change passedCount qty
        const newPassedQty = currentGame.passedCount + 1;
        if (newPassedQty === currentGame.turnOrder.length) {
          await currentGame.update({
            phase: "finished",
            passedCount: newPassedQty
          });
        } else {
          await currentGame.update({
            previousBoard: currentGame.board,
            phase: "turn",
            turn: getNextTurn(currentGame),
            passedCount: newPassedQty
          });
        }
      } else {
        // check if all letters in turn were i user's hand
        if (
          userBoard.some(row =>
            row.some(
              letter =>
                letter !== null &&
                !currentGame.letters[currentUser.id].includes(letter)
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

        // remove those letters from user hand
        const putLetters = userBoard.reduce((acc, row) => {
          return acc.concat(
            row.reduce((accum, cell) => {
              if (cell) {
                accum.push(cell);
              }
              return accum;
            }, [])
          );
        }, []);

        // extract put letters from all letters
        putLetters.sort();
        const temporaryLetters = [
          ...currentGame.letters[currentUser.id]
        ].sort();
        const keepLetters = temporaryLetters.reduce(
          (acc, letter) => {
            if (acc.i === putLetters.length) {
              acc.letters.push(letter);
              return acc;
            }
            if (letter === putLetters[acc.i]) {
              acc.i++;
              return acc;
            }
            acc.letters.push(letter);
            return acc;
          },
          { i: 0, letters: [] }
        ).letters;

        const updatedLetters = {
          ...currentGame.letters,
          [currentUser.id]: keepLetters
        };
        // copy game board to previous board
        // change game phase to validation
        // return passedCount to 0
        await currentGame.update({
          previousBoard: currentGame.board,
          board: newBoard,
          phase: "validation",
          letters: updatedLetters,
          putLetters: putLetters,
          passedCount: 0
        });
      }

      // fetch game from db
      const updatedGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          }
        ]
      });
      const action = {
        type: "GAME_UPDATED",
        payload: { gameId: gameId, game: updatedGame }
      };
      const string = JSON.stringify(action);
      res.send(updatedGame);
      stream.send(string);
    } catch (error) {
      next(error);
    }
  });

  router.post("/game/:id/approve", authMiddleware, async (req, res, next) => {
    // get user from authmiddleware
    const currentUser = req.user;
    console.log(currentUser.id, "currentUser.id");

    const gameId = req.params.id;
    try {
      const currentGame = await game.findByPk(gameId);
      if (currentGame.phase !== "validation") {
        return next("Wrong game phase");
      }
      // only user who's turn is next, can validate the turn
      const newTurn = getNextTurn(currentGame);
      if (
        !currentGame.turnOrder.includes(currentUser.id) ||
        currentUser.id !== currentGame.turnOrder[newTurn]
      ) {
        return next(`User ${currentUser.id} has no right to approve the turn`);
      }
      const updatedGameLetters = updateGameLetters(currentGame);

      await currentGame.update({
        phase: "turn",
        turn: newTurn,
        letters: updatedGameLetters,
        putLetters: []
      });
      const updatedGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          }
        ]
      });
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId: gameId,
          game: updatedGame
        }
      };
      const string = JSON.stringify(action);
      res.send(updatedGame);
      stream.send(string);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = factory;
