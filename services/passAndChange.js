const { User, Game } = require("../models");
const { getNextTurn, giveLetters, substract } = require("./game");
const updateGame = require("./updateGame");

/**
 * Updates game accoring to validation and returns updated game
 */
module.exports = async (currentUserId, gameId, lettersToChange) => {
  const game = await Game.findByPk(gameId);
  // user can exchange letters only in his turn
  if (
    game.phase === "turn" &&
    game.turnOrder.includes(currentUserId) &&
    currentUserId === game.turnOrder[game.turn]
  ) {
    //check if user exchanges his own letters

    // substract letters to change
    const previousUserLetters = game.letters[currentUserId];
    const remainingLetters = substract(previousUserLetters, lettersToChange);
    // give new letters to user
    const updatedBagAndUserLetters = giveLetters(
      game.letters.pot,
      remainingLetters,
      lettersToChange
    );
    const updatedUserLetters = updatedBagAndUserLetters.userLetters;
    const updatedPot = updatedBagAndUserLetters.bag;

    await updateGame(game, {
      previousBoard: game.board,
      phase: "turn",
      turn: getNextTurn(game),
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
