import { Router, Request, Response, NextFunction } from "express";
import authMiddleware from "../auth/middleware.js";
import createGame from "../services/create.js";
import joinGame from "../services/join.js";
import startGame from "../services/start.js";
import { getUpdatedGameForLobby, LobbyGameAction } from "../services/lobby.js";
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
import { canSeeGame, canUseInfiniteBoard } from "../services/board.js";
import { toData } from "../auth/jwt.js";
import User from "../models/user.js";
import Game from "../models/game.js";
import { MyServer } from "../index";

interface RequestBody {
  userBoard: string[][];
  wildCardOnBoard: { [x: string]: { [x: string]: string } };
}

export default function factory(webSocketsServer: MyServer) {
  const router = Router();

  // while infinite-board access is restricted, infinite games are kept out
  // of the shared lobby room: its audience includes arbitrary users
  const emitToLobby = (
    game: { boardType?: string | null },
    action: LobbyGameAction
  ) => {
    if (canSeeGame(game)) {
      webSocketsServer.to("lobby").emit("message", action);
    }
  };

  router.post(
    "/create",
    authMiddleware,
    async (req: RequestWithUser, res, next) => {
      const currentUser = req.user;
      const { maxPlayers, language, players: playersIds, boardType } = req.body;
      const players = Number(maxPlayers);
      if (!players || players < 2 || players > 8) {
        return res
          .status(400)
          .send({ message: "maxPlayers must be between 2 and 8" });
      }
      if (
        boardType !== undefined &&
        !["classic", "infinite"].includes(boardType)
      ) {
        return res
          .status(400)
          .send({ message: "boardType must be classic or infinite" });
      }
      if (boardType === "infinite" && !canUseInfiniteBoard(currentUser.id)) {
        return res.status(403).send({
          message: "infinite board is not available for this account",
        });
      }
      try {
        const updatedGame = await createGame(
          currentUser,
          maxPlayers,
          playersIds,
          language,
          boardType
        );
        const lobbyAction = getUpdatedGameForLobby(updatedGame);
        emitToLobby(updatedGame, lobbyAction);
        res.send(lobbyAction.payload);
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    "/join/:id",
    authMiddleware,
    validateGameId,
    async (req: RequestWithAdditionalFields, res, next) => {
      const currentUser = req.user;
      const gameId: number = req.gameId;
      try {
        const gameToJoin = await Game.findByPk(gameId, {
          attributes: ["boardType"],
        });
        if (gameToJoin && !canSeeGame(gameToJoin, currentUser.id)) {
          return res.status(404).send({ message: "game not found" });
        }
        const updatedGame = await joinGame(currentUser, gameId);
        const lobbyAction = getUpdatedGameForLobby(updatedGame);
        emitToLobby(updatedGame, lobbyAction);
        const updatedGameAction = {
          type: GAME_UPDATED,
          payload: { gameId: updatedGame.id, game: updatedGame },
        };
        webSocketsServer
          .to(gameId.toString())
          .emit("message", updatedGameAction);
        res.send(updatedGameAction);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/start/:id",
    authMiddleware,
    validateGameId,
    async (req: RequestWithGameId, res, nxt) => {
      const gameId = req.gameId;
      try {
        const updatedGame = await startGame(gameId);
        const updatedGameAction = {
          type: GAME_UPDATED,
          payload: { gameId, game: updatedGame },
        };
        webSocketsServer
          .to(gameId.toString())
          .emit("message", updatedGameAction);
        const lobbyAction = getUpdatedGameForLobby(updatedGame);
        emitToLobby(updatedGame, lobbyAction);
        sendTurnNotification(updatedGame.activeUserId, gameId);
        res.sendStatus(204);
      } catch (error) {
        nxt(error);
      }
    }
  );

  router.get(
    "/game/:id",
    validateGameId,
    async (req: RequestWithGameId, res, next) => {
      const gameId = req.gameId;
      try {
        const game = await fetchGame(gameId);
        // this endpoint has no auth middleware, so for restricted games the
        // requester is identified from the optional Authorization header.
        // A game the user may not see is reported exactly like a missing one,
        // which reveals nothing and is what every client already handles
        const gameForRequester =
          game && canSeeGame(game, getOptionalUserId(req)) ? game : null;
        const action = {
          type: GAME_UPDATED,
          payload: { gameId, game: gameForRequester },
        };
        res.send(action);
      } catch (error) {
        next(error);
      }
    }
  );

  //turn of the game
  router.post(
    "/game/:id/turn",
    authMiddleware,
    validateGameId,
    validateRequestBody,
    async (req: RequestWithAdditionalFields, res, next) => {
      // get user from auth middleware
      const currentUserId = req.user.id;
      const gameId = req.gameId;
      const { userBoard, wildCardOnBoard } = req.body as RequestBody;
      try {
        const updatedGameAction = await makeTurn(
          currentUserId,
          gameId,
          userBoard,
          wildCardOnBoard
        );

        if (updatedGameAction.type === DUPLICATED_WORDS) {
          res.send(updatedGameAction);
          return;
        }

        const responseAction = {
          type: NO_DUPLICATIONS,
        };
        res.send(responseAction);

        webSocketsServer
          .to(gameId.toString())
          .emit("message", updatedGameAction);

        if (updatedGameAction.payload.game.phase === "finished") {
          const deleteGameAction = {
            type: DELETE_GAME_IN_LOBBY,
            payload: gameId,
          };
          await sendFinishedGameNotifications(gameId);
          webSocketsServer.to("lobby").emit("message", deleteGameAction);
        } else {
          const lobbyAction = getUpdatedGameForLobby(
            updatedGameAction.payload.game
          );
          emitToLobby(updatedGameAction.payload.game, lobbyAction);
        }

        // every time after a turn we need to inform the next player about their turn
        sendTurnNotification(
          updatedGameAction.payload.game.activeUserId,
          gameId
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/game/:id/approve",
    authMiddleware,
    validateGameId,
    async (req: RequestWithAdditionalFields, res, next) => {
      // get user from auth middleware
      const currentUserId = req.user.id;
      const gameId = req.gameId;
      const validation = req.body.validation;
      try {
        const updatedGame = await validateTurn(
          currentUserId,
          gameId,
          validation
        );
        const action = {
          type: GAME_UPDATED,
          payload: {
            gameId,
            game: updatedGame,
          },
        };
        webSocketsServer.to(gameId.toString()).emit("message", action);
        const lobbyAction = getUpdatedGameForLobby(updatedGame);
        emitToLobby(updatedGame, lobbyAction);
        if (validation === "no") {
          sendDisapproveNotification(updatedGame.activeUserId, gameId);
        }
        res.sendStatus(204);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/game/:id/undo",
    authMiddleware,
    validateGameId,
    async (req: RequestWithAdditionalFields, res, next) => {
      // get user from auth middleware
      const currentUserId = req.user.id;
      const gameId = req.gameId;
      try {
        const updatedGame = await undoTurn(currentUserId, gameId);
        const action = {
          type: GAME_UPDATED,
          payload: {
            gameId,
            game: updatedGame,
          },
        };
        webSocketsServer.to(gameId.toString()).emit("message", action);
        const lobbyAction = getUpdatedGameForLobby(updatedGame);
        emitToLobby(updatedGame, lobbyAction);
        res.sendStatus(204);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/game/:id/change",
    authMiddleware,
    validateGameId,
    async (req: RequestWithAdditionalFields, res, next) => {
      // get user from auth middleware
      const currentUserId = req.user.id;
      const gameId = req.gameId;
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
        webSocketsServer.to(gameId.toString()).emit("message", action);
        const lobbyAction = getUpdatedGameForLobby(updatedGame);
        emitToLobby(updatedGame, lobbyAction);
        sendTurnNotification(updatedGame.activeUserId, gameId);
        res.sendStatus(204);
      } catch (error) {
        next(error);
      }
    }
  );
  return router;
}

interface Params {
  id: string;
}

export interface RequestWithUser extends Request {
  user: User;
}

interface RequestWithGameId extends Request<Params> {
  gameId: number;
}

type RequestWithAdditionalFields = RequestWithGameId & RequestWithUser;

function getOptionalUserId(req: {
  headers: { authorization?: string };
}): number | undefined {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      return toData(header.substring(7)).userId;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function validateGameId(
  req: RequestWithGameId,
  res: Response,
  next: NextFunction
) {
  const gameId = parseInt(req.params.id);
  if (isNaN(gameId)) {
    res.status(400).send({ message: "Invalid game ID" });
    return;
  }
  req.gameId = gameId;
  next();
}

function validateRequestBody(
  req: RequestWithAdditionalFields,
  res: Response,
  next: NextFunction
) {
  const body = req.body as RequestBody;

  if (!body.userBoard || !Array.isArray(body.userBoard)) {
    return res
      .status(400)
      .json({ error: "userBoard is required and must be an array" });
  }

  if ("wildCardOnBoard" in body) {
    if (
      typeof body.wildCardOnBoard !== "object" ||
      body.wildCardOnBoard === null
    ) {
      return res
        .status(400)
        .json({ error: "wildCardOnBoard must be an object" });
    }

    for (const key in body.wildCardOnBoard) {
      const innerObj = body.wildCardOnBoard[key];
      if (typeof innerObj !== "object" || innerObj === null) {
        return res
          .status(400)
          .json({ error: `wildCardOnBoard[${key}] must be an object` });
      }

      for (const innerKey in innerObj) {
        if (typeof innerObj[innerKey] !== "string") {
          return res.status(400).json({
            error: `wildCardOnBoard[${key}][${innerKey}] must be a string`,
          });
        }
      }
    }
  }

  req.body = body as RequestBody;
  next();
}
