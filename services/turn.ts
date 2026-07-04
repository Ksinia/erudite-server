import Game from "../models/game.js";
import { getNextTurn, getResult, getWords, subtract } from "./game.js";
import fetchGame from "./fetchGame.js";
import updateGame from "./updateGame.js";
import {
  DUPLICATED_WORDS,
  GAME_UPDATED,
} from "../constants/outgoingMessageTypes.js";

/**
 * Makes turn and returns updated game
 * or returns duplicated words action if there are duplicated words
 */
export default async (
  currentUserId: number,
  gameId: number,
  userBoard: (string | null)[][],
  wildCardOnBoard: { [x: string]: { [x: string]: string } }
): Promise<{ type: string; payload: { gameId: number; game: Game } }> => {
  const game = await Game.findByPk(gameId);
  // check if game is in turn phase and if it is current user's turn
  if (game.phase === "turn" && game.turnOrder[game.turn] === currentUserId) {
    //check if user passed
    // a placement is any non-null cell (matching newBoard/ownership below),
    // so a board of only non-null junk is not mistaken for a pass
    if (!userBoard.some((row) => row.some((letter) => letter !== null))) {
      // copy game board to previous board
      // change game phase to next turn, no need to validate pass
      // change passedCount qty
      const newPassedQty = game.passedCount + 1;
      if (newPassedQty === game.turnOrder.length * 2) {
        let result = game.result;
        if (game.turns.length !== 0) {
          result = getResult(game.score, game.turns, game.turnOrder);
        }
        await updateGame(game, {
          phase: "finished",
          passedCount: newPassedQty,
          lettersChanged: false,
          result,
          turns: [
            ...game.turns,
            {
              words: [],
              score: 0,
              user: currentUserId,
              changedLetters: false,
            },
          ],
          activeUserId: null,
        });
      } else {
        const newTurn = getNextTurn(game);
        await updateGame(game, {
          previousBoard: game.board,
          phase: "turn",
          turn: newTurn,
          activeUserId: game.turnOrder[newTurn],
          passedCount: newPassedQty,
          validated: "unknown",
          turns: [
            ...game.turns,
            {
              words: [],
              score: 0,
              user: currentUserId,
              changedLetters: false,
            },
          ],
        });
      }
    } else {
      // user didn't pass
      const userLetters = game.letters[currentUserId].slice();
      const currentGameBoard = game.board.map((row) => row.slice());
      const wildCardsInHandQty = userLetters.filter(
        (letter) => letter === "*"
      ).length;
      // check if user has changed wildcard (*) on board
      let usedWildCardsQty = 0;
      userBoard.forEach((row) => {
        row.forEach((cell) => {
          if (cell && cell[0] === "*") {
            usedWildCardsQty += 1;
          }
        });
      });
      const allowedChangedWildCardQty = usedWildCardsQty - wildCardsInHandQty;
      let leftQty = allowedChangedWildCardQty;
      let ok = true;
      Object.keys(wildCardOnBoard).forEach((y) => {
        Object.keys(wildCardOnBoard[y]).forEach((x) => {
          const letter = wildCardOnBoard[y][x];
          if (letter && leftQty > 0) {
            const index = userLetters.indexOf(letter);
            const boardCell = currentGameBoard[y]?.[x];
            // a valid swap needs the real letter in hand and the target
            // cell to be a wildcard on the board representing that letter
            const isValidSwap =
              index !== -1 &&
              typeof boardCell === "string" &&
              boardCell[0] === "*" &&
              boardCell[1] === letter;
            if (!isValidSwap) {
              // don't mutate the hand or board on an invalid swap;
              // the turn is rejected below
              ok = false;
              return;
            }
            userLetters.splice(index, 1, "*");
            currentGameBoard[y][x] = letter;
            leftQty -= 1;
          }
        });
      });
      // check that every placed letter comes from the user's hand,
      // counting duplicates: a wildcard cell ("*x") consumes a "*"
      // from the hand, any other cell consumes the letter itself
      if (ok) {
        const availableLetters: { [letter: string]: number } = {};
        userLetters.forEach((letter) => {
          availableLetters[letter] = (availableLetters[letter] || 0) + 1;
        });
        userBoard.forEach((row) => {
          row.forEach((cell) => {
            // an empty cell is null; anything else is treated as a
            // placement (consistent with how newBoard is built below),
            // so non-null junk like 0/false/"" falls through and is
            // rejected rather than silently skipped
            if (cell === null) {
              return;
            }
            let neededLetter: string | null = null;
            if (typeof cell === "string") {
              if (cell[0] === "*" && cell.length === 2) {
                neededLetter = "*";
              } else if (cell[0] !== "*" && cell.length === 1) {
                neededLetter = cell;
              }
            }
            if (neededLetter !== null && availableLetters[neededLetter]) {
              availableLetters[neededLetter] -= 1;
            } else {
              ok = false;
            }
          });
        });
      }

      if (ok) {
        // check if all letters are placed on empty cells
        if (
          !userBoard.some((row, y) =>
            row.some(
              (letter: string | null, x) =>
                letter !== null && game.board[y][x] !== null
            )
          )
        ) {
          // add user letters to current board
          const newBoard = currentGameBoard.map((row, y) =>
            row.map((cell, x) => {
              if (cell === null && userBoard[y][x] !== null) {
                return userBoard[y][x];
              } else {
                return cell;
              }
            })
          );

          // check if there is any duplicated word
          //if no, proceed with updating game and sending it in stream
          // if yes, don't update the game, send action with error as a response only
          const words = getWords(newBoard, game.board);

          // Check for duplicate words within current turn
          const duplicatesWithinTurn = words.filter(
            (word, index) => words.indexOf(word) !== index
          );

          // Check for duplicate words from previous turns
          const duplicatesFromPreviousTurns = words.filter((word: string) => {
            return game.turns.some((turn) => {
              if (turn.words.length > 0) {
                const listOfWords = turn.words.map((wordObject) =>
                  Object.keys(wordObject)[0].replace(/\*/gi, "")
                );
                return listOfWords.includes(word);
              }
            });
          });

          const duplicatedWords = [
            ...new Set([
              ...duplicatesWithinTurn,
              ...duplicatesFromPreviousTurns,
            ]),
          ];
          if (duplicatedWords.length > 0) {
            return {
              type: DUPLICATED_WORDS,
              payload: duplicatedWords,
            };
          } else {
            // remove those letters from user hand
            const putLetters = userBoard.reduce((acc, row) => {
              return acc.concat(
                row.reduce((accum, cell) => {
                  if (cell) {
                    accum.push(cell[0]);
                  }
                  return accum;
                }, [])
              );
            }, []);

            // extract put letters from all letters
            const keepLetters = subtract(userLetters, putLetters);
            const updatedLetters = {
              ...game.letters,
              [currentUserId]: keepLetters,
            };
            // copy game board to previous board
            // change game phase to validation
            // do not need to return passedCount to 0,
            // because the turn may be undone
            await updateGame(game, {
              previousBoard: game.board,
              board: newBoard,
              phase: "validation",
              letters: updatedLetters,
              // putLetters: putLetters,
              previousLetters: game.letters[currentUserId],
              validated: "unknown",
              lettersChanged: false,
              wordsForValidation: words,
              activeUserId: game.turnOrder[getNextTurn(game)],
            });
          }
        }
      }
    }
  }

  // fetch game from db
  const updatedGame = await fetchGame(gameId);
  return {
    type: GAME_UPDATED,
    payload: { gameId, game: updatedGame },
  };
};
