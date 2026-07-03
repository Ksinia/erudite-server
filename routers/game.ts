import { Router, Request, Response, NextFunction } from "express";
import authMiddleware, { getBearerToken } from "../auth/middleware.js";
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
  BOARD_OUT_OF_DATE,
  DELETE_GAME_IN_LOBBY,
  DUPLICATED_WORDS,
  NO_DUPLICATIONS,
} from "../constants/outgoingMessageTypes.js";
import {
  sendDisapproveNotification,
  sendTurnNotification,
} from "../services/game.js";
import { canSeeGame, canUseInfiniteBoard } from "../services/board.js";
import {
  emitGameUpdated,
  gameUpdatedAction,
  parseClientFeatures,
  supportsInfiniteBoard,
} from "../services/gamePayload.js";
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

  /**
   * The lobby room holds arbitrary sockets, so a restricted game cannot be
   * broadcast to it wholesale. It is sent to each socket that may see it
   * instead, which is what lets an allowed player watch such a game appear,
   * fill up and change phase like any other.
   */
  const emitToLobby = (
    game: { boardType?: string | null },
    action: LobbyGameAction | { type: string; payload: number }
  ) => {
    if (canSeeGame(game, null, false)) {
      webSocketsServer.to("lobby").emit("message", action);
      return;
    }
    const lobby = webSocketsServer.sockets.adapter.rooms.get("lobby");
    if (!lobby) {
      return;
    }
    for (const socketId of lobby) {
      const target = webSocketsServer.sockets.sockets.get(socketId);
      if (
        target &&
        canSeeGame(
          game,
          target.data.playerId,
          supportsInfiniteBoard(target.data.features)
        )
      ) {
        target.emit("message", action);
      }
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
      if (playersIds !== undefined && !Array.isArray(playersIds)) {
        return res.status(400).send({ message: "players must be an array" });
      }
      if (boardType === "infinite") {
        // every player must have access, otherwise the game would be
        // invisible to someone it waits for
        const participants = [
          currentUser.id,
          ...(playersIds ? playersIds.map(Number) : []),
        ];
        if (participants.some((id) => !canUseInfiniteBoard(id))) {
          return res.status(403).send({
            message: "infinite board is not available for all players",
          });
        }
        if (!clientSupportsInfiniteBoard(req)) {
          return res.status(403).send({
            message: "this client cannot show an infinite board",
          });
        }
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
        if (
          gameToJoin &&
          !canSeeGame(
            gameToJoin,
            currentUser.id,
            clientSupportsInfiniteBoard(req)
          )
        ) {
          return res.status(404).send({ message: "game not found" });
        }
        const updatedGame = await joinGame(currentUser, gameId);
        const lobbyAction = getUpdatedGameForLobby(updatedGame);
        emitToLobby(updatedGame, lobbyAction);
        // the room broadcast is built per socket, the response for the
        // joining user alone
        emitGameUpdated(webSocketsServer, gameId, updatedGame);
        res.send(
          gameUpdatedAction(updatedGame.id, updatedGame, currentUser.id)
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/start/:id",
    authMiddleware,
    validateGameId,
    async (req: RequestWithAdditionalFields, res, nxt) => {
      const gameId = req.gameId;
      try {
        const gameToStart = await Game.findByPk(gameId, {
          attributes: ["boardType"],
        });
        if (
          gameToStart &&
          !canSeeGame(
            gameToStart,
            req.user.id,
            clientSupportsInfiniteBoard(req)
          )
        ) {
          return res.status(404).send({ message: "game not found" });
        }
        const updatedGame = await startGame(gameId);
        emitGameUpdated(webSocketsServer, gameId, updatedGame);
        const lobbyAction = getUpdatedGameForLobby(updatedGame);
        emitToLobby(updatedGame, lobbyAction);
        sendTurnNotification(
          updatedGame.activeUserId,
          gameId,
          updatedGame.boardType
        );
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
        // this endpoint has no auth middleware, so the requester is
        // identified from the optional Authorization header: it decides both
        // whether a restricted game exists for them and whose hand they get.
        // A game the user may not see is reported exactly like a missing one,
        // which reveals nothing and is what every client already handles
        const userId = await getOptionalUserId(req);
        const gameForRequester =
          game && canSeeGame(game, userId, clientSupportsInfiniteBoard(req))
            ? game
            : null;
        res.send(gameUpdatedAction(gameId, gameForRequester, userId));
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

        if (updatedGameAction.type === BOARD_OUT_OF_DATE) {
          res.status(409).send(updatedGameAction);
          return;
        }

        const responseAction = {
          type: NO_DUPLICATIONS,
        };
        res.send(responseAction);

        emitGameUpdated(
          webSocketsServer,
          gameId,
          updatedGameAction.payload.game
        );

        if (updatedGameAction.payload.game.phase === "finished") {
          const deleteGameAction = {
            type: DELETE_GAME_IN_LOBBY,
            payload: gameId,
          };
          await sendFinishedGameNotifications(gameId);
          emitToLobby(updatedGameAction.payload.game, deleteGameAction);
        } else {
          const lobbyAction = getUpdatedGameForLobby(
            updatedGameAction.payload.game
          );
          emitToLobby(updatedGameAction.payload.game, lobbyAction);
        }

        // every time after a turn we need to inform the next player about their turn
        sendTurnNotification(
          updatedGameAction.payload.game.activeUserId,
          gameId,
          updatedGameAction.payload.game.boardType
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
        emitGameUpdated(webSocketsServer, gameId, updatedGame);
        const lobbyAction = getUpdatedGameForLobby(updatedGame);
        emitToLobby(updatedGame, lobbyAction);
        if (validation === "no") {
          sendDisapproveNotification(
            updatedGame.activeUserId,
            gameId,
            updatedGame.boardType
          );
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
        emitGameUpdated(webSocketsServer, gameId, updatedGame);
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
        emitGameUpdated(webSocketsServer, gameId, updatedGame);
        const lobbyAction = getUpdatedGameForLobby(updatedGame);
        emitToLobby(updatedGame, lobbyAction);
        sendTurnNotification(
          updatedGame.activeUserId,
          gameId,
          updatedGame.boardType
        );
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

function clientSupportsInfiniteBoard(req: {
  headers: Request["headers"];
}): boolean {
  return supportsInfiniteBoard(
    parseClientFeatures(req.headers["x-client-features"])
  );
}

/**
 * The id behind an optional Authorization header, for routes that carry no
 * auth middleware. It decides both what the caller may see and whose hand
 * the payload keeps, so the account is loaded and checked the way the
 * middleware checks it: a token that outlived its account reads as a
 * stranger here too rather than keeping access to a restricted game.
 */
async function getOptionalUserId(req: Request<Params>): Promise<number | null> {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }
  try {
    const { userId } = toData(token);
    const user = await User.findByPk(userId, { attributes: ["id", "name"] });
    if (!user || /^\[deleted_\d+\]$/.test(user.name)) {
      return null;
    }
    return user.id;
  } catch {
    return null;
  }
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
