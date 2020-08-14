const { Router } = require("express");
const authMiddleware = require("../auth/middleware");
const { user, game } = require("../models");
const { getNextTurn, substract, giveLetters } = require("../services/game");
const createGame = require("../services/create");
const joinGame = require("../services/join");
const { getUpdatedGameForLobby, startGame } = require("../services/start");
const makeTurn = require("../services/turn");
const validateTurn = require("../services/validation");
const undoTurn = require("../services/undo");

function factory(gameStream, lobbyStream) {
  const router = new Router();

  router.post("/create", authMiddleware, async (req, res, next) => {
    const currentUser = req.user;
    const { maxPlayers, language, players: playersIds } = req.body;
    try {
      const action = await createGame(
        currentUser,
        maxPlayers,
        playersIds,
        language
      );
      lobbyStream.send(JSON.stringify(action));
      res.send(action.payload);
    } catch (error) {
      next(error);
    }
  });

  router.put("/join", authMiddleware, async (req, res, next) => {
    const currentUser = req.user;
    const gameId = req.body.gameId;
    try {
      const updatedGame = await joinGame(currentUser, gameId);
      const actionForLobby = {
        type: "UPDATED_GAME_IN_LOBBY",
        payload: updatedGame,
      };
      lobbyStream.send(JSON.stringify(actionForLobby));
      const updatedGameAction = {
        type: "GAME_UPDATED",
        payload: { gameId: updatedGame.id, game: updatedGame },
      };
      gameStream.send(JSON.stringify(updatedGameAction));
      res.send(updatedGameAction);
    } catch (error) {
      next(error);
    }
  });

  router.post("/start", authMiddleware, async (req, res, nxt) => {
    const gameId = req.body.gameId;
    try {
      const updatedGameAction = await startGame(gameId);
      gameStream.send(JSON.stringify(updatedGameAction));
      // this response is important
      res.send(updatedGameAction.payload.game);
      const lobbyUpdatedGameAction = await getUpdatedGameForLobby(gameId);
      lobbyStream.send(JSON.stringify(lobbyUpdatedGameAction));
    } catch (error) {
      nxt(error);
    }
  });

  router.get("/game/:id", async (req, res, next) => {
    const gameId = parseInt(req.params.id);
    try {
      const currentGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      const action = {
        type: "GAME_UPDATED",
        payload: { gameId, game: currentGame },
      };
      const string = JSON.stringify(action);
      gameStream.init(req, res);
      gameStream.send(string);
    } catch (error) {
      next(error);
    }
  });

  //turn of the game
  router.post("/game/:id/turn", authMiddleware, async (req, res, next) => {
    // get user from authmiddleware
    const currentUserId = req.user.id;
    const gameId = parseInt(req.params.id);
    const { userBoard, wildCardOnBoard } = req.body;
    try {
      const updatedGame = await makeTurn(
        currentUserId,
        gameId,
        userBoard,
        wildCardOnBoard
      );
      if (updatedGame.type === "DUPLICATED_WORDS") {
        res.send(JSON.stringify(updatedGame));
      } else {
        if (updatedGame.phase === "finished") {
          const lobbyAction = {
            type: "DELETE_GAME_IN_LOBBY",
            payload: gameId,
          };
          lobbyStream.send(JSON.stringify(lobbyAction));
        }
        const responseAction = {
          type: "NO_DUPLICATIONS",
        };
        res.send(JSON.stringify(responseAction));
        const streamAction = {
          type: "GAME_UPDATED",
          payload: { gameId, game: updatedGame },
        };
        gameStream.send(JSON.stringify(streamAction));
      }
    } catch (error) {
      next(error);
    }
  });

  router.post("/game/:id/approve", authMiddleware, async (req, res, next) => {
    // get user from authmiddleware
    const currentUserId = req.user.id;
    const gameId = parseInt(req.params.id);
    const validation = req.body.validation;
    try {
      const updatedGame = await validateTurn(currentUserId, gameId, validation);
      res.send(JSON.stringify(updatedGame.id));
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      gameStream.send(JSON.stringify(action));
    } catch (error) {
      next(error);
    }
  });

  router.post("/game/:id/undo", authMiddleware, async (req, res, next) => {
    // get user from authmiddleware
    const currentUserId = req.user.id;
    const gameId = parseInt(req.params.id);
    try {
      const updatedGame = await undoTurn(currentUserId, gameId);
      res.send(JSON.stringify(updatedGame.id));
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      gameStream.send(JSON.stringify(action));
    } catch (error) {
      next(error);
    }
  });

  router.post("/game/:id/change", authMiddleware, async (req, res, next) => {
    // get user from authmiddleware
    const currentUser = req.user;
    const gameId = parseInt(req.params.id);
    const lettersToChange = req.body.letters;
    try {
      const currentGame = await game.findByPk(gameId);
      // user can exchange letters only in his turn
      if (
        currentGame.phase === "turn" &&
        currentGame.turnOrder.includes(currentUser.id) &&
        currentUser.id === currentGame.turnOrder[currentGame.turn]
      ) {
        //check if user exchanges his own letters

        // substract letters to change
        const previousUserLetters = currentGame.letters[currentUser.id];
        const remainingLetters = substract(
          previousUserLetters,
          lettersToChange
        );
        // give new letters to user
        const updatedBagAndUserLetters = giveLetters(
          currentGame.letters.pot,
          remainingLetters,
          lettersToChange
        );
        const updatedUserLetters = updatedBagAndUserLetters.userLetters;
        const updatedPot = updatedBagAndUserLetters.bag;

        await currentGame.update({
          previousBoard: currentGame.board,
          phase: "turn",
          turn: getNextTurn(currentGame),
          letters: {
            ...currentGame.letters,
            pot: updatedPot,
            [currentUser.id]: updatedUserLetters,
          },
          putLetters: [],
          previousLetters: [],
          lettersChanged: true,
          turns: [
            ...currentGame.turns,
            { words: [], score: 0, user: currentUser.id, changedLetters: true },
          ],
        });
      }
      const updatedGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      const string = JSON.stringify(action);
      res.send(JSON.stringify(updatedGame.id));
      gameStream.send(string);
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = factory;
