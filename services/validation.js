import Game from "../models/game.js";
import { getNextTurn, turnWordsAndScore, updateGameLetters } from "./game.js";
import lettersSets from "../constants/letterSets/index.js";
import fetchGame from "./fetchGame.js";
import updateGame from "./updateGame.js";

/**
 * Updates game according to validation and returns updated game
 */
export default async (currentUserId, gameId, validation) => {
  const game = await Game.findByPk(gameId);
  const newTurn = getNextTurn(game);
  // check if it is right phase and user to validate
  // only user whose turn is next, can validate the turn
  if (
    game.phase === "validation" &&
    game.turnOrder.includes(currentUserId) &&
    currentUserId === game.turnOrder[newTurn]
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
        activeUserId: game.turnOrder[newTurn],
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
        activeUserId: game.turnOrder[game.turn],
      });
    }
  }
  return fetchGame(gameId);
};
