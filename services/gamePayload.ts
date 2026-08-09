import Game from "../models/game.js";
import { GAME_UPDATED } from "../constants/outgoingMessageTypes.js";
import { sanitizeGame, SanitizedGame } from "./sanitizeGame.js";
import type { MyServer } from "../index.js";

/**
 * A client declares what it can handle through the X-Client-Features header
 * on requests, and through the features field of ADD_USER_TO_SOCKET on the
 * socket. Anything that says nothing is treated as an older build.
 */
export const INFINITE_BOARD_FEATURE = "infinite-board";

export const parseClientFeatures = (value?: string | string[]): string[] => {
  if (Array.isArray(value)) {
    return value;
  }
  return (value || "")
    .split(",")
    .map((feature) => feature.trim())
    .filter(Boolean);
};

export const supportsInfiniteBoard = (features?: string[]): boolean =>
  !!features && features.includes(INFINITE_BOARD_FEATURE);

type Board = (string | null)[][];
export type SparseCell = [number, number, string];

/**
 * An infinite board is mostly empty, and a full grid costs the square of its
 * side on every update. Only the occupied cells travel, together with the
 * dimensions needed to rebuild the grid.
 */
export const toSparseCells = (board: Board): SparseCell[] => {
  const cells: SparseCell[] = [];
  board.forEach((row, y) =>
    row.forEach((letter, x) => {
      if (letter !== null) {
        cells.push([y, x, letter]);
      }
    })
  );
  return cells;
};

/**
 * Replaces the two grids of an infinite game with their occupied cells.
 * Classic games are left exactly as they were, so clients that never learn
 * about the sparse form keep working.
 */
export const gameForTransport = (game: SanitizedGame) => {
  if (game.boardType !== "infinite" || !game.board) {
    return game;
  }
  const { board, previousBoard, ...rest } = game;
  return {
    ...rest,
    boardSize: { rows: board.length, cols: board[0].length },
    boardCells: toSparseCells(board),
    previousBoardCells: toSparseCells(previousBoard || []),
  };
};

/**
 * The one shape a game takes on its way out. Both steps are per recipient:
 * first the hands of the other players go, then an infinite board shrinks
 * to its occupied cells, so no payload can skip either.
 */
export const gameUpdatedAction = (
  gameId: number,
  game: Game | null,
  userId: number | null
) => ({
  type: GAME_UPDATED,
  payload: {
    gameId,
    game: game ? gameForTransport(sanitizeGame(game, userId)) : null,
  },
});

/**
 * Emits GAME_UPDATED to every socket in the game room, each socket getting
 * the payload built for its own player. Only sockets allowed to see the
 * game are in the room, so the sparse form is safe to send to all of them.
 */
export const emitGameUpdated = (
  webSocketsServer: MyServer,
  gameId: number,
  game: Game | null
) => {
  // callers may pass the result of a lookup that can be null (a missing
  // game row); skip rather than send an empty update to a live room
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
    socket.emit("message", gameUpdatedAction(gameId, game, playerId));
  }
};
