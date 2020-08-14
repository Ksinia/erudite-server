const { game: Game } = require("../models");
const { getNextTurn, turnWordsAndScore, updateGameLetters } = require("./game");
const lettersSets = require("../constants/letterSets");
const fetchGame = require("./fetchGame");
const updateGame = require("./updateGame");

/**
 * Updates game accoring to validation and returns updated game
 */
module.exports = async (currentUserId, gameId, validation) => {
  const game = await Game.findByPk(gameId);
  const newTurn = getNextTurn(game);
  // check if it is right phase and user to validate
  // only user who's turn is next, can validate the turn
  if (
    (game.phase === "validation",
    game.turnOrder.includes(currentUserId) &&
      currentUserId === game.turnOrder[newTurn])
  ) {
    if (validation === "yes") {
      const currentTurnUserId = game.turnOrder[game.turn];
      const bonus15 = game.letters[currentTurnUserId].length === 0;
      const values = lettersSets[game.language].values;
      const turn = turnWordsAndScore(
        game.board,
        game.previousBoard,
        bonus15,
        values
      );
      const updatedScore = {
        ...game.score,
        [currentTurnUserId]: (game.score[currentTurnUserId] += turn.score),
      };
      let updatedTurns = game.turns;
      // this condition is required because previously created games don't contain turns object
      if (game.turns) {
        updatedTurns = [
          ...game.turns,
          { ...turn, user: currentTurnUserId, changedLetters: false },
        ];
      }
      const updatedGameLetters = updateGameLetters(game);
      await updateGame(game, {
        phase: "turn",
        turn: newTurn,
        letters: updatedGameLetters,
        putLetters: [],
        previousLetters: [],
        score: updatedScore,
        validated: "yes",
        turns: updatedTurns,
        wordsForValidation: [],
        passedCount: 0,
      });
    } else if (validation === "no") {
      await updateGame(game, {
        validated: "no",
      });
    }
  }
  return fetchGame(gameId);
};
