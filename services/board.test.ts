import test from "node:test";
import assert from "node:assert/strict";

import {
  canSeeGame,
  canUseInfiniteBoard,
  CLASSIC_BOARD_SIZE,
  getLetterBonus,
  getWordBonus,
  growBoard,
  MAX_BOARD_SIZE,
  PATTERN_PERIOD,
} from "./board.js";
import { letterBonuses, wordBonuses } from "../constants/bonuses.js";

type Board = (string | null)[][];

const empty = (height: number, width: number): Board =>
  Array(height)
    .fill(null)
    .map(() => Array(width).fill(null));

const withLetters = (
  height: number,
  width: number,
  cells: [number, number][]
): Board => {
  const board = empty(height, width);
  cells.forEach(([y, x]) => (board[y][x] = "а"));
  return board;
};

const ORIGIN = { x: 0, y: 0 };

test("classic board keeps the original bonus tables", () => {
  for (let y = 0; y < CLASSIC_BOARD_SIZE; y++) {
    for (let x = 0; x < CLASSIC_BOARD_SIZE; x++) {
      assert.equal(
        getWordBonus(y, x, "classic", ORIGIN),
        wordBonuses[y] && wordBonuses[y][x]
      );
      assert.equal(
        getLetterBonus(y, x, "classic", ORIGIN),
        letterBonuses[y] && letterBonuses[y][x]
      );
    }
  }
});

test("infinite board reproduces the classic layout at the origin", () => {
  // the whole classic square, including row and column 14, which the tiling
  // aliases onto 0: that aliasing is what makes the shared seam work
  for (let y = 0; y < CLASSIC_BOARD_SIZE; y++) {
    for (let x = 0; x < CLASSIC_BOARD_SIZE; x++) {
      assert.equal(
        getWordBonus(y, x, "infinite", ORIGIN),
        wordBonuses[y] && wordBonuses[y][x],
        `word bonus at ${y},${x}`
      );
      assert.equal(
        getLetterBonus(y, x, "infinite", ORIGIN),
        letterBonuses[y] && letterBonuses[y][x],
        `letter bonus at ${y},${x}`
      );
    }
  }
});

test("bonus pattern repeats every 14 cells and shares its border rows", () => {
  assert.equal(getWordBonus(0, 0, "infinite", ORIGIN), 3);
  assert.equal(
    getWordBonus(PATTERN_PERIOD, PATTERN_PERIOD, "infinite", ORIGIN),
    3
  );
  assert.equal(getWordBonus(0, PATTERN_PERIOD * 3, "infinite", ORIGIN), 3);
  // the seam is a single shared row, not two triple-word rows side by side
  assert.equal(
    getWordBonus(0, CLASSIC_BOARD_SIZE, "infinite", ORIGIN),
    undefined
  );
  assert.equal(
    getWordBonus(CLASSIC_BOARD_SIZE, 0, "infinite", ORIGIN),
    undefined
  );
});

test("bonus lookup follows the origin", () => {
  const shifted = { x: 5, y: 3 };
  assert.equal(getWordBonus(3, 5, "infinite", shifted), 3);
  assert.equal(getLetterBonus(3 + 1, 5 + 5, "infinite", shifted), 3);
  // cells above and to the left of the origin hand the tiling a negative
  // coordinate, which is the ordinary case once a board has grown
  const cells: [number, number][] = [
    [3, 5],
    [4, 10],
    [10, 12],
    [0, 0],
  ];
  cells.forEach(([y, x]) => {
    assert.equal(
      getWordBonus(y - PATTERN_PERIOD, x - PATTERN_PERIOD, "infinite", shifted),
      getWordBonus(y, x, "infinite", shifted),
      `word bonus one tile up and left of ${y},${x}`
    );
    assert.equal(
      getLetterBonus(
        y - PATTERN_PERIOD,
        x - PATTERN_PERIOD,
        "infinite",
        shifted
      ),
      getLetterBonus(y, x, "infinite", shifted),
      `letter bonus one tile up and left of ${y},${x}`
    );
  });
});

test("the last cells of room go to one side rather than nowhere", () => {
  // a board one cell short of the cap with letters close to both edges:
  // splitting the single cell evenly would round to nothing and freeze it
  const size = MAX_BOARD_SIZE - 1;
  const board = withLetters(size, size, [
    [6, 6],
    [size - 7, size - 7],
  ]);
  const result = growBoard(board, empty(size, size), ORIGIN);
  assert.equal(result.board.length, MAX_BOARD_SIZE, "grew into the last cell");
  assert.equal(result.board[0].length, MAX_BOARD_SIZE);
  // the cell went to one side, so exactly one of the two moved
  assert.ok(
    (result.origin.y === 1 && result.origin.x === 1) ||
      (result.origin.y === 0 && result.origin.x === 0),
    `origin moved by the padding actually applied: ${JSON.stringify(
      result.origin
    )}`
  );
});

test("a board with letters far from the edges does not grow", () => {
  const board = withLetters(15, 15, [[7, 7]]);
  const result = growBoard(board, empty(15, 15), ORIGIN);
  assert.equal(result.board.length, 15);
  assert.equal(result.board[0].length, 15);
  assert.deepEqual(result.origin, ORIGIN);
});

test("a board grows on every side a letter comes close to", () => {
  // the leftmost letter sits within a rack of the left edge, the rightmost
  // does not, so only the left side grows
  const board = withLetters(15, 15, [
    [7, 5],
    [7, 6],
    [7, 7],
  ]);
  const result = growBoard(board, empty(15, 15), ORIGIN);
  assert.equal(result.board[0].length, 22);
  assert.equal(result.board.length, 15);
  assert.deepEqual(result.origin, { x: 7, y: 0 });
  // letters and the padded previousBoard stay aligned with the new origin
  assert.equal(result.board[7][12], "а");
  assert.equal(result.previousBoard.length, result.board.length);
  assert.equal(result.previousBoard[0].length, result.board[0].length);
});

test("a board grows towards the bottom and the right as well", () => {
  const board = withLetters(15, 15, [
    [12, 12],
    [13, 13],
  ]);
  const result = growBoard(board, empty(15, 15), ORIGIN);
  assert.equal(result.board.length, 22);
  assert.equal(result.board[0].length, 22);
  // padding went to the far side, so the origin does not move
  assert.deepEqual(result.origin, ORIGIN);
  assert.equal(result.board[13][13], "а");
});

test("a board short of room splits what is left between both sides", () => {
  // letters near both edges of a board that is already close to the cap
  const size = MAX_BOARD_SIZE - 4;
  const board = withLetters(size, size, [
    [1, 1],
    [size - 2, size - 2],
  ]);
  const result = growBoard(board, empty(size, size), ORIGIN);
  assert.ok(
    result.board.length <= MAX_BOARD_SIZE &&
      result.board[0].length <= MAX_BOARD_SIZE,
    `stays within the cap, got ${result.board.length}x${result.board[0].length}`
  );
  // the two cells of room left are shared, one to each side
  assert.deepEqual(result.origin, { x: 2, y: 2 });
  assert.equal(result.board.length, MAX_BOARD_SIZE);
});

test("a growing board keeps a free rack beyond the letters, up to the cap", () => {
  let board = withLetters(15, 15, [[7, 7]]);
  let previousBoard = empty(15, 15);
  let origin = ORIGIN;
  // walk a letter towards the top left corner, growing as it goes
  for (let step = 0; step < 400; step++) {
    let minY = Infinity;
    let minX = Infinity;
    board.forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell !== null) {
          minY = Math.min(minY, y);
          minX = Math.min(minX, x);
        }
      })
    );
    if (minY === 0 || minX === 0) break;
    board[minY - 1][minX - 1] = "а";
    const grown = growBoard(board, previousBoard, origin);
    board = grown.board;
    previousBoard = grown.previousBoard;
    origin = grown.origin;

    const belowCap =
      board.length < MAX_BOARD_SIZE && board[0].length < MAX_BOARD_SIZE;
    assert.ok(
      board.length <= MAX_BOARD_SIZE && board[0].length <= MAX_BOARD_SIZE,
      `board stays within the cap, got ${board.length}x${board[0].length}`
    );
    if (belowCap) {
      let top = Infinity;
      let left = Infinity;
      board.forEach((row, y) =>
        row.forEach((cell, x) => {
          if (cell !== null) {
            top = Math.min(top, y);
            left = Math.min(left, x);
          }
        })
      );
      assert.ok(
        top >= 7 && left >= 7,
        `a rack of free cells remains: ${top},${left}`
      );
    }
  }
  // the walk is long enough to reach the cap, and stops there
  assert.equal(board.length, MAX_BOARD_SIZE);
  assert.equal(board[0].length, MAX_BOARD_SIZE);
});

test("access is closed until user ids are listed", () => {
  const previous = process.env.INFINITE_BOARD_USERS;
  const infinite = { boardType: "infinite" };
  const classic = { boardType: "classic" };

  delete process.env.INFINITE_BOARD_USERS;
  assert.equal(canUseInfiniteBoard(3), false);
  assert.equal(canUseInfiniteBoard(undefined), false);
  assert.equal(canSeeGame(infinite, 3), false);
  assert.equal(canSeeGame(classic, 3), true);
  assert.equal(canSeeGame(classic, undefined), true);

  process.env.INFINITE_BOARD_USERS = "";
  assert.equal(canUseInfiniteBoard(3), false);

  // a malformed value must not open the feature
  process.env.INFINITE_BOARD_USERS = "abc";
  assert.equal(canUseInfiniteBoard(3), false);
  process.env.INFINITE_BOARD_USERS = "3abc";
  assert.equal(canUseInfiniteBoard(3), false);
  process.env.INFINITE_BOARD_USERS = "3.5";
  assert.equal(canUseInfiniteBoard(3), false);

  process.env.INFINITE_BOARD_USERS = " 3, 4 ";
  assert.equal(canUseInfiniteBoard(3), true);
  assert.equal(canUseInfiniteBoard(4), true);
  assert.equal(canUseInfiniteBoard(1), false);
  assert.equal(canUseInfiniteBoard(undefined), false);
  assert.equal(canSeeGame(infinite, 4, true), true);
  assert.equal(canSeeGame(infinite, 1, true), false);
  // an allowed account on a client that cannot draw the board is still refused
  assert.equal(canSeeGame(infinite, 4, false), false);
  // and the default is refusal rather than permission
  assert.equal(canSeeGame(infinite, 4), false);
  assert.equal(canSeeGame(classic, 4), true);

  if (previous === undefined) {
    delete process.env.INFINITE_BOARD_USERS;
  } else {
    process.env.INFINITE_BOARD_USERS = previous;
  }
});
