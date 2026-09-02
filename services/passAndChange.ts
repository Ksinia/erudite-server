import Game from "../models/game.js";
import User from "../models/user.js";
import { getNextTurn, giveLetters, holdsAll, subtract } from "./game.js";
import updateGame from "./updateGame.js";

/**
 * Updates game according to validation and returns updated game
 */
export default async (currentUserId, gameId, lettersToChange) => {
  const game = await Game.findByPk(gameId);
  // user can exchange letters only in his turn, and only letters he holds:
  // subtract drops just the tiles it finds while giveLetters returns every
  // requested tile to the pot and draws that many, so a request naming tiles
  // the player does not have would grow the rack and put letters into the
  // pot that were never in the game
  if (
    game.phase === "turn" &&
    game.turnOrder.includes(currentUserId) &&
    currentUserId === game.turnOrder[game.turn] &&
    holdsAll(game.letters[currentUserId], lettersToChange)
  ) {
    // subtract letters to change
    const previousUserLetters = game.letters[currentUserId];
    const remainingLetters = subtract(previousUserLetters, lettersToChange);
    // giveLetters puts the letters being exchanged back into the bag before
    // drawing, so the draw can never come up short and an infinite game
    // needs no extra set here; the bag is refilled when a rack is topped up
    const updatedBagAndUserLetters = giveLetters(
      game.letters.pot,
      remainingLetters,
      lettersToChange,
      currentUserId
    );
    const updatedUserLetters = updatedBagAndUserLetters.userLetters;
    const updatedPot = updatedBagAndUserLetters.bag;

    await updateGame(game, {
      previousBoard: game.board,
      phase: "turn",
      turn: getNextTurn(game),
      activeUserId: game.turnOrder[getNextTurn(game)],
      letters: {
        ...game.letters,
        pot: updatedPot,
        [currentUserId]: updatedUserLetters,
      },
      putLetters: [],
      previousLetters: [],
      lettersChanged: true,
      turns: [
        ...game.turns,
        { words: [], score: 0, user: currentUserId, changedLetters: true },
      ],
    });
  }
  return Game.findByPk(gameId, {
    include: [
      {
        model: User,
        as: "users",
        attributes: ["id", "name"],
      },
    ],
  });
};
