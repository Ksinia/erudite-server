import Game from "../models/game.js";
import fetchGame from "./fetchGame.js";
import updateGame from "./updateGame.js";

/**
 * Undoes the turn and returns updated game
 */
export default async (currentUserId, gameId) => {
  const game = await Game.findByPk(gameId);
  // user can only undo own turn
  if (
    game.phase === "validation" &&
    game.turnOrder.includes(currentUserId) &&
    currentUserId === game.turnOrder[game.turn]
  ) {
    if (game.previousLetters && game.previousLetters.length > 0) {
      await updateGame(game, {
        board: game.previousBoard,
        phase: "turn",
        letters: {
          ...game.letters,
          [currentUserId]: game.previousLetters,
        },
        previousLetters: [],
      });
    } else {
      // TODO: get rid of all operations with putLetters in db
      await updateGame(game, {
        board: game.previousBoard,
        phase: "turn",
        letters: {
          ...game.letters,
          [currentUserId]: game.letters[currentUserId].concat(game.putLetters),
        },
        putLetters: [],
      });
    }
  }
  return fetchGame(gameId);
};
