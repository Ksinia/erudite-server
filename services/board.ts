import { letterBonuses, wordBonuses } from "../constants/bonuses.js";

export const CLASSIC_BOARD_SIZE = 15;
// the pattern repeats every 14 cells, not 15: the outer x3 rows/columns of
// the classic layout are identical, so adjacent tiles share one border row
// instead of doubling it at the seam
export const PATTERN_PERIOD = CLASSIC_BOARD_SIZE - 1;
// a full rack is 7 letters, so with this margin a player can always
// extend a word outward without hitting the edge of an infinite board
export const RACK_SIZE = 7;
export const EDGE_MARGIN = RACK_SIZE;
export const GROWTH_STEP = RACK_SIZE;
/**
 * Upper bound on either dimension. The board is meant to feel unbounded,
 * but it is stored as a grid in one row and drawn as a grid by the client,
 * so a game drifting outward for hundreds of turns would keep enlarging
 * both. At this size the far edges behave like the edges of a classic board.
 */
export const MAX_BOARD_SIZE = 99;

export interface BoardOrigin {
  x: number;
  y: number;
}

/**
 * INFINITE_BOARD_USERS lists the user ids that can see, join and create
 * infinite games, comma-separated. The feature is closed by default: when
 * the variable is unset or empty, nobody has access, so a deployment that
 * forgets to set it does not expose the feature.
 * Read lazily so it does not depend on dotenv initialization order.
 */
export const canUseInfiniteBoard = (userId?: number | null): boolean => {
  const allowedIds = (process.env.INFINITE_BOARD_USERS || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
  return userId != null && allowedIds.includes(userId);
};

/**
 * Whether a game may be shown to a given user (or anonymous visitor when
 * userId is undefined) on the client they are using. Only infinite games are
 * ever hidden: they need both an allowed account and a client that can draw
 * a board which changes size, so an older build is never handed one.
 */
export const canSeeGame = (
  game: { boardType?: string | null },
  userId?: number | null,
  clientSupportsInfiniteBoard = false
): boolean => {
  return (
    game.boardType !== "infinite" ||
    (canUseInfiniteBoard(userId) && clientSupportsInfiniteBoard)
  );
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
  // grow only while there is room left under the cap, and split what
  // remains between the two sides that need it
  const verticalRoom = Math.max(0, MAX_BOARD_SIZE - height);
  const horizontalRoom = Math.max(0, MAX_BOARD_SIZE - width);
  const wantTop = minY < EDGE_MARGIN;
  const wantBottom = height - 1 - maxY < EDGE_MARGIN;
  const wantLeft = minX < EDGE_MARGIN;
  const wantRight = width - 1 - maxX < EDGE_MARGIN;
  // the last cells of room go to one side rather than being divided into
  // nothing, which would leave the board frozen just short of the cap
  const share = (room: number, first: boolean, second: boolean) => {
    const sides = (first ? 1 : 0) + (second ? 1 : 0);
    if (sides === 0 || room === 0) {
      return [0, 0];
    }
    const each = Math.min(GROWTH_STEP, Math.floor(room / sides));
    const leftover = Math.min(GROWTH_STEP - each, room - each * sides);
    return [
      first ? each + (second ? leftover : 0) : 0,
      second ? each + (first ? 0 : leftover) : 0,
    ];
  };
  const [padTop, padBottom] = share(verticalRoom, wantTop, wantBottom);
  const [padLeft, padRight] = share(horizontalRoom, wantLeft, wantRight);
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
