import Game from "../models/game.js";
import { GAME_UPDATED } from "../constants/outgoingMessageTypes.js";

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
export const gameForTransport = (game: Game) => {
  if (!game || game.boardType !== "infinite" || !game.board) {
    return game;
  }
  const json = typeof game.toJSON === "function" ? game.toJSON() : { ...game };
  const { board, previousBoard, ...rest } = json as Game;
  return {
    ...rest,
    boardSize: { rows: board.length, cols: board[0].length },
    boardCells: toSparseCells(board),
    previousBoardCells: toSparseCells(previousBoard || []),
  };
};

export const gameUpdatedAction = (gameId: number, game: Game) => ({
  type: GAME_UPDATED,
  payload: { gameId, game: gameForTransport(game) },
});
