import type { InferAttributes } from "sequelize";
import type Game from "../models/game.js";
import { GAME_UPDATED } from "../constants/outgoingMessageTypes.js";
import type { MyServer } from "../index.js";

type GameJson = InferAttributes<Game>;
type GameLetters = GameJson["letters"];

/**
 * Returns a plain game object safe to send to the given user:
 * the recipient keeps their own hand, the pot is masked to an array
 * of the same length (the client only uses its size), and other
 * players' letters are removed. Anonymous recipients get no hand.
 */
export const sanitizeGame = (game: Game, userId: number | null) => {
  const json = game.toJSON() as GameJson;
  const sourceLetters = json.letters;
  const letters: GameLetters = {
    pot: Array(sourceLetters?.pot?.length ?? 0).fill(""),
  };
  if (userId !== null && sourceLetters?.[userId]) {
    letters[userId] = sourceLetters[userId];
  }
  const isTurnUser = userId !== null && json.turnOrder?.[json.turn] === userId;
  return {
    ...json,
    letters,
    previousLetters: isTurnUser ? json.previousLetters : [],
    putLetters: isTurnUser ? json.putLetters : [],
  };
};

/**
 * Emits GAME_UPDATED to every socket in the game room, each socket
 * receiving the game sanitized for its own player.
 */
export const emitGameUpdated = (
  webSocketsServer: MyServer,
  gameId: number,
  game: Game | null
) => {
  // callers may pass the result of a lookup that can be null (a missing
  // game row); skip rather than crash on sanitizeGame's toJSON()
  if (!game) {
    return;
  }
  const room = webSocketsServer.sockets.adapter.rooms.get(gameId.toString());
  if (!room) {
    return;
  }
  for (const socketId of room) {
    const socket = webSocketsServer.sockets.sockets.get(socketId);
    if (!socket) {
      continue;
    }
    // -1 is the sentinel for an unauthenticated socket; any real user id
    // (which start at 1) keeps its own hand
    const playerId =
      socket.data.playerId != null && socket.data.playerId !== -1
        ? socket.data.playerId
        : null;
    socket.emit("message", {
      type: GAME_UPDATED,
      payload: { gameId, game: sanitizeGame(game, playerId) },
    });
  }
};
