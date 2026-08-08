import { letterBonuses, wordBonuses } from "../constants/bonuses.js";

export const CLASSIC_BOARD_SIZE = 15;
// the pattern repeats every 14 cells, not 15: the outer x3 rows/columns of
// the classic layout are identical, so adjacent tiles share one border row
// instead of doubling it at the seam
export const PATTERN_PERIOD = CLASSIC_BOARD_SIZE - 1;
// a full rack is 7 letters, so with this margin a player can always
// extend a word outward without hitting the edge of an infinite board
export const EDGE_MARGIN = 7;
export const GROWTH_STEP = 7;

export interface BoardOrigin {
  x: number;
  y: number;
}

/**
 * INFINITE_BOARD_USERS limits who can see, join and create infinite games:
 * a comma-separated list of user ids. Unset or empty means everyone.
 * Read lazily so it does not depend on dotenv initialization order.
 */
export const canUseInfiniteBoard = (userId?: number | null): boolean => {
  const allowedIds = (process.env.INFINITE_BOARD_USERS || "")
    .split(",")
    .map((value) => parseInt(value.trim()))
    .filter((id) => !isNaN(id));
  if (allowedIds.length === 0) {
    return true;
  }
  return userId != null && allowedIds.includes(userId);
};

/**
 * Whether a game may be shown to a given user (or anonymous visitor when
 * userId is undefined). Only infinite games are ever hidden.
 */
export const canSeeGame = (
  game: { boardType?: string | null },
  userId?: number | null
): boolean => {
  return game.boardType !== "infinite" || canUseInfiniteBoard(userId);
};

export const DEFAULT_ORIGIN: BoardOrigin = { x: 0, y: 0 };

type BonusMap = { [y: number]: { [x: number]: number } };
type Board = (string | null)[][];

const mod = (n: number): number =>
  ((n % PATTERN_PERIOD) + PATTERN_PERIOD) % PATTERN_PERIOD;

const lookupBonus = (
  map: BonusMap,
  y: number,
  x: number,
  boardType: string,
  origin: BoardOrigin
): number | undefined => {
  // on an infinite board the classic 15x15 bonus pattern tiles the whole
  // plane; origin is the current position of the original top-left cell
  if (boardType === "infinite") {
    const row = map[mod(y - origin.y)];
    return row && row[mod(x - origin.x)];
  }
  const row = map[y];
  return row && row[x];
};

export const getWordBonus = (
  y: number,
  x: number,
  boardType: string,
  origin: BoardOrigin
): number | undefined => lookupBonus(wordBonuses, y, x, boardType, origin);

export const getLetterBonus = (
  y: number,
  x: number,
  boardType: string,
  origin: BoardOrigin
): number | undefined => lookupBonus(letterBonuses, y, x, boardType, origin);

/**
 * Pads every side of the board where a letter is closer than EDGE_MARGIN
 * to the edge. previousBoard is padded identically so per-cell comparison
 * between the two stays aligned. Origin shifts by the top/left padding.
 */
export const growBoard = (
  board: Board,
  previousBoard: Board,
  origin: BoardOrigin
): { board: Board; previousBoard: Board; origin: BoardOrigin } => {
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  board.forEach((row, y) =>
    row.forEach((cell, x) => {
      if (cell !== null) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    })
  );
  if (minY === Infinity) {
    return { board, previousBoard, origin };
  }
  const height = board.length;
  const width = board[0].length;
  const padTop = minY < EDGE_MARGIN ? GROWTH_STEP : 0;
  const padBottom = height - 1 - maxY < EDGE_MARGIN ? GROWTH_STEP : 0;
  const padLeft = minX < EDGE_MARGIN ? GROWTH_STEP : 0;
  const padRight = width - 1 - maxX < EDGE_MARGIN ? GROWTH_STEP : 0;
  if (!padTop && !padBottom && !padLeft && !padRight) {
    return { board, previousBoard, origin };
  }
  const newWidth = width + padLeft + padRight;
  const emptyRow = (): null[] => Array(newWidth).fill(null);
  const pad = (b: Board): Board => [
    ...Array(padTop).fill(null).map(emptyRow),
    ...b.map((row) => [
      ...Array(padLeft).fill(null),
      ...row,
      ...Array(padRight).fill(null),
    ]),
    ...Array(padBottom).fill(null).map(emptyRow),
  ];
  return {
    board: pad(board),
    previousBoard: pad(previousBoard),
    origin: { x: origin.x + padLeft, y: origin.y + padTop },
  };
};
