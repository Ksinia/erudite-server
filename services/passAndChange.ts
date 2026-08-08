import Game from "../models/game.js";
import User from "../models/user.js";
import { getNextTurn, giveLetters, shuffle, subtract } from "./game.js";
import lettersSets from "../constants/letterSets/index.js";
import updateGame from "./updateGame.js";

/**
 * Updates game according to validation and returns updated game
 */
export default async (currentUserId, gameId, lettersToChange) => {
  const game = await Game.findByPk(gameId);
  // user can exchange letters only in his turn
  if (
    game.phase === "turn" &&
    game.turnOrder.includes(currentUserId) &&
    currentUserId === game.turnOrder[game.turn]
  ) {
    //check if user exchanges his own letters

    // subtract letters to change
    const previousUserLetters = game.letters[currentUserId];
    const remainingLetters = subtract(previousUserLetters, lettersToChange);
    // an infinite game never runs out of letters: refill the pot with
    // another complete set once it cannot cover a full exchange
    let pot = game.letters.pot;
    if (game.boardType === "infinite" && pot.length < 7) {
      pot = pot.concat(shuffle(lettersSets[game.language].letters.slice()));
    }
    // give new letters to user
    const updatedBagAndUserLetters = giveLetters(
      pot,
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
