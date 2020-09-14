const { Router } = require("express");
const authMiddleware = require("../auth/middleware");
const createGame = require("../services/create");
const joinGame = require("../services/join");
const startGame = require("../services/start");
const { getUpdatedGameForLobby } = require("../services/lobby");
const makeTurn = require("../services/turn");
const validateTurn = require("../services/validation");
const undoTurn = require("../services/undo");
const passAndChange = require("../services/passAndChange");
const fetchGame = require("../services/fetchGame");
const { sendFinishedGameNotifications } = require("../services/mail");

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
      const lobbyAction = getUpdatedGameForLobby(updatedGame);
      lobbyStream.send(JSON.stringify(lobbyAction));
      res.send(lobbyAction.payload);
    } catch (error) {
      next(error);
    }
  });

  router.put("/join", authMiddleware, async (req, res, next) => {
    const currentUser = req.user;
    const gameId = req.body.gameId;
    try {
      const updatedGame = await joinGame(currentUser, gameId);
      const lobbyAction = getUpdatedGameForLobby(updatedGame);
      lobbyStream.send(JSON.stringify(lobbyAction));
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
      const updatedGame = await startGame(gameId);
      const updatedGameAction = {
        type: "GAME_UPDATED",
        payload: { gameId, game: updatedGame },
      };
      gameStream.send(JSON.stringify(updatedGameAction));
      // this response is important
      res.send(updatedGameAction.payload.game);
      const lobbyAction = getUpdatedGameForLobby(updatedGame);
      lobbyStream.send(JSON.stringify(lobbyAction));
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
        res.send(updatedGame);
        return;
      }

      const responseAction = {
        type: "NO_DUPLICATIONS",
      };
      res.send(responseAction);

      const streamAction = {
        type: "GAME_UPDATED",
        payload: { gameId, game: updatedGame },
      };
      gameStream.send(JSON.stringify(streamAction));

      let lobbyAction = getUpdatedGameForLobby(updatedGame);
      if (updatedGame.phase === "finished") {
        lobbyAction = {
          type: "DELETE_GAME_IN_LOBBY",
          payload: gameId,
        };
        sendFinishedGameNotifications(gameId);
      }
      lobbyStream.send(JSON.stringify(lobbyAction));
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
      res.send(updatedGame.id);
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      gameStream.send(JSON.stringify(action));
      const lobbyAction = getUpdatedGameForLobby(updatedGame);
      lobbyStream.send(JSON.stringify(lobbyAction));
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
      res.send(updatedGame.id);
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      gameStream.send(JSON.stringify(action));
      const lobbyAction = getUpdatedGameForLobby(updatedGame);
      lobbyStream.send(JSON.stringify(lobbyAction));
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
      res.send(updatedGame.id);
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      gameStream.send(JSON.stringify(action));
      const lobbyAction = getUpdatedGameForLobby(updatedGame);
      lobbyStream.send(JSON.stringify(lobbyAction));
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = factory;
