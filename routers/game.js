import { Router } from "express";
import authMiddleware from "../auth/middleware.js";
import createGame from "../services/create.js";
import joinGame from "../services/join.js";
import startGame from "../services/start.js";
import { getUpdatedGameForLobby } from "../services/lobby.js";
import makeTurn from "../services/turn.js";
import validateTurn from "../services/validation.js";
import undoTurn from "../services/undo.js";
import passAndChange from "../services/passAndChange.js";
import fetchGame from "../services/fetchGame.js";
import { sendFinishedGameNotifications } from "../services/mail.js";
import {
  DELETE_GAME_IN_LOBBY,
  DUPLICATED_WORDS,
  GAME_UPDATED,
  NO_DUPLICATIONS,
} from "../constants/outgoingMessageTypes.js";
import {
  sendDisapproveNotification,
  sendTurnNotification,
} from "../services/game.js";

export default function factory(webSocketsServer) {
  const router = Router();

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
      webSocketsServer.to("lobby").emit("message", lobbyAction);
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
      webSocketsServer.to("lobby").emit("message", lobbyAction);
      const updatedGameAction = {
        type: GAME_UPDATED,
        payload: { gameId: updatedGame.id, game: updatedGame },
      };
      webSocketsServer.to(gameId).emit("message", updatedGameAction);
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
        type: GAME_UPDATED,
        payload: { gameId, game: updatedGame },
      };
      webSocketsServer.to(gameId).emit("message", updatedGameAction);
      const lobbyAction = getUpdatedGameForLobby(updatedGame);
      webSocketsServer.to("lobby").emit("message", lobbyAction);
      sendTurnNotification(updatedGame.activeUserId, gameId);
      res.sendStatus(204);
    } catch (error) {
      nxt(error);
    }
  });

  router.get("/game/:id", async (req, res, next) => {
    const gameId = parseInt(req.params.id);
    try {
      const game = await fetchGame(gameId);
      const action = {
        type: GAME_UPDATED,
        payload: { gameId, game },
      };
      res.send(action);
    } catch (error) {
      next(error);
    }
  });

  //turn of the game
  router.post("/game/:id/turn", authMiddleware, async (req, res, next) => {
    // get user from auth middleware
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

      if (updatedGame.type === DUPLICATED_WORDS) {
        res.send(updatedGame);
        return;
      }

      const responseAction = {
        type: NO_DUPLICATIONS,
      };
      res.send(responseAction);

      const streamAction = {
        type: GAME_UPDATED,
        payload: { gameId, game: updatedGame },
      };
      webSocketsServer.to(gameId).emit("message", streamAction);

      let lobbyAction = getUpdatedGameForLobby(updatedGame);
      if (updatedGame.phase === "finished") {
        lobbyAction = {
          type: DELETE_GAME_IN_LOBBY,
          payload: gameId,
        };
        await sendFinishedGameNotifications(gameId);
      }
      webSocketsServer.to("lobby").emit("message", lobbyAction);

      // every time after a turn we need to inform the next player about his turn
      sendTurnNotification(updatedGame.activeUserId, gameId);
    } catch (error) {
      next(error);
    }
  });

  router.post("/game/:id/approve", authMiddleware, async (req, res, next) => {
    // get user from auth middleware
    const currentUserId = req.user.id;
    const gameId = parseInt(req.params.id);
    const validation = req.body.validation;
    try {
      const updatedGame = await validateTurn(currentUserId, gameId, validation);
      const action = {
        type: GAME_UPDATED,
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      webSocketsServer.to(gameId).emit("message", action);
      const lobbyAction = getUpdatedGameForLobby(updatedGame);
      webSocketsServer.to("lobby").emit("message", lobbyAction);
      if (validation === "no") {
        sendDisapproveNotification(updatedGame.activeUserId, gameId);
      }
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  router.post("/game/:id/undo", authMiddleware, async (req, res, next) => {
    // get user from auth middleware
    const currentUserId = req.user.id;
    const gameId = parseInt(req.params.id);
    try {
      const updatedGame = await undoTurn(currentUserId, gameId);
      const action = {
        type: GAME_UPDATED,
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      webSocketsServer.to(gameId).emit("message", action);
      const lobbyAction = getUpdatedGameForLobby(updatedGame);
      webSocketsServer.to("lobby").emit("message", lobbyAction);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  router.post("/game/:id/change", authMiddleware, async (req, res, next) => {
    // get user from auth middleware
    const currentUserId = req.user.id;
    const gameId = parseInt(req.params.id);
    const lettersToChange = req.body.letters;
    try {
      const updatedGame = await passAndChange(
        currentUserId,
        gameId,
        lettersToChange
      );
      const action = {
        type: GAME_UPDATED,
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      webSocketsServer.to(gameId).emit("message", action);
      const lobbyAction = getUpdatedGameForLobby(updatedGame);
      webSocketsServer.to("lobby").emit("message", lobbyAction);
      sendTurnNotification(updatedGame.activeUserId, gameId);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
