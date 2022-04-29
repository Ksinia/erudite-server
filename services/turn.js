const { Game } = require("../models");
const { getWords, substract, getNextTurn, getResult } = require("./game");
const fetchGame = require("./fetchGame");
const updateGame = require("./updateGame");
const { DUPLICATED_WORDS } = require("../constants/outgoingMessageTypes");

/**
 * Makes turn and returns updated game
 * or returns duplicated words action if there are dublicated words
 */
module.exports = async (currentUserId, gameId, userBoard, wildCardOnBoard) => {
  const game = await Game.findByPk(gameId);
  // check if game is in turn phase and if it is current user's turn
  if (game.phase === "turn" && game.turnOrder[game.turn] === currentUserId) {
    //check if user passed
    if (!userBoard.some((row) => row.some((letter) => letter))) {
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
      let userLetters = game.letters[currentUserId].slice();
      let currentGameBoard = game.board.map((row) => row.slice());
      const wildCardsInHandQty = userLetters.filter((letter) => letter === "*")
        .length;
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
            if (index === -1 || letter !== currentGameBoard[y][x][1]) {
              ok = false;
            }
            userLetters.splice(index, 1, "*");
            currentGameBoard[y][x] = letter;
            leftQty -= 1;
          }
        });
      });
      if (ok) {
        // check if all letters in turn were in user's hand
        // TODO: take possible duplicates into account
        // TODO: rewrite, it doesn't work because of wild cards from board
        // if (
        //   !userBoard.some((row) =>
        //     row.some((letter) => {
        //       console.log(letter);
        //       return (
        //         letter !== null &&
        //         ((letter[0] !== "*" && !userLetters.includes(letter)) ||
        //           (letter[0] === "*" &&
        //             (!userLetters.includes("*") ||
        //               letter.length > 2 ||
        //               !lettersSets[currentGame.language].letters.includes(
        //                 letter[1]
        //               ))))
        //       );
        //     })
        //   )
        // ) {

        // check if all letters are placed on empty cells
        if (
          !userBoard.some((row, y) =>
            row.some(
              (letter, x) => letter !== null && game.board[y][x] !== null
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

          const duplicatedWords = words.filter((word) => {
            return game.turns.some((turn) => {
              if (turn.words.length > 0) {
                const listOfWords = turn.words.map((wordObject) =>
                  Object.keys(wordObject)[0].replace(/\*/gi, "")
                );
                return listOfWords.includes(word);
              }
            });
          });
          if (duplicatedWords && duplicatedWords.length > 0) {
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
            const keepLetters = substract(userLetters, putLetters);
            const updatedLetters = {
              ...game.letters,
              [currentUserId]: keepLetters,
            };
            // copy game board to previous board
            // change game phase to validation
            // do not need to return passedCount to 0,
            // because the turn may me undone
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
      // }
    }
  }
  // fetch game from db
  return fetchGame(gameId);
};
