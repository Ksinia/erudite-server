const { Router } = require("express");
const authMiddleware = require("../auth/middleware");
const createGame = require("../services/create");
const joinGame = require("../services/join");
const { getUpdatedGameForLobby, startGame } = require("../services/start");
const makeTurn = require("../services/turn");
const validateTurn = require("../services/validation");
const undoTurn = require("../services/undo");
const passAndChange = require("../services/passAndChange");
const fetchGame = require("../services/fetchGame");

function factory(gameStream, lobbyStream) {
  const router = new Router();

  router.post("/create", authMiddleware, async (req, res, next) => {
    const currentUser = req.user;
    const { maxPlayers, language, players: playersIds } = req.body;
    try {
      const updatedGame = await createGame(
        currentUser,
        maxPlayers,
        playersIds,
        language
      );
      const action = {
        type: "NEW_GAME",
        payload: updatedGame,
      };
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
      const game = await fetchGame(gameId);
      const action = {
        type: "GAME_UPDATED",
        payload: { gameId, game },
      };
      gameStream.init(req, res);
      gameStream.send(JSON.stringify(action));
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
    const currentUserId = req.user.id;
    const gameId = parseInt(req.params.id);
    const lettersToChange = req.body.letters;
    try {
      const updatedGame = await passAndChange(
        currentUserId,
        gameId,
        lettersToChange
      );
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
  return router;
}

module.exports = factory;
