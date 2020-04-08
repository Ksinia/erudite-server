const sequelize = require("sequelize");

const { Router } = require("express");
const authMiddleware = require("../auth/middleware");
const { room, user, game } = require("../models");
const { originalLetters, values } = require("../russianLetters");

const wordBonuses = {
  0: { 0: 3, 7: 3, 14: 3 },
  1: { 1: 2, 13: 2 },
  2: { 2: 2, 12: 2 },
  3: { 3: 2, 11: 2 },
  4: { 4: 2, 10: 2 },
  7: { 0: 3, 14: 3 },
  10: { 4: 2, 10: 2 },
  11: { 3: 2, 11: 2 },
  12: { 2: 2, 12: 2 },
  13: { 1: 2, 13: 2 },
  14: { 0: 3, 7: 3, 14: 3 }
};

const letterBonuses = {
  0: { 3: 2, 11: 2 },
  1: { 5: 3, 9: 3 },
  2: { 6: 2, 8: 2 },
  3: { 0: 2, 7: 2, 14: 2 },
  5: { 1: 3, 13: 3 },
  6: { 2: 2, 6: 2, 8: 2, 12: 2 },
  7: { 3: 2, 11: 2 },
  8: { 2: 2, 6: 2, 8: 2, 12: 2 },
  9: { 1: 3, 13: 3 },
  11: { 0: 2, 7: 2, 14: 2 },
  12: { 6: 2, 8: 2 },
  13: { 5: 3, 9: 3 },
  14: { 3: 2, 11: 2 }
};

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

function getNextTurn(game) {
  return (game.turn + 1) % game.turnOrder.length;
}

function updateGameLetters(game) {
  const currentUserId = game.turnOrder[game.turn];
  const currentUserLetters = game.letters[currentUserId];
  let requiredQty = 7 - currentUserLetters.length;
  if (game.letters.pot.length < requiredQty) {
    requiredQty = game.letters.pot.length;
  }
  let newLetters = [];
  while (newLetters.length !== requiredQty) {
    newLetters.push(
      game.letters.pot.splice(
        Math.floor(Math.random() * game.letters.pot.length),
        1
      )[0]
    );
  }
  const updatedUserLetters = currentUserLetters.concat(newLetters);
  const updatedGameLetters = {
    ...game.letters,
    [currentUserId]: updatedUserLetters
  };
  return updatedGameLetters;
}
// как найти слово? Находим букву, двигаемся влево от нее по обеим доскам, пока не найдем пустую
// клетку. Затем двигаемся вправо от нее по обеим доскам пока не найдем пустую клетку. Если
// между пустыми клетками 1 клетка, то это не слово. В противном случае - слово. Проверяем,
// на что умножать слово. Добавляем стоимость всех букв, проверяя умножение каждой буквы.
// умножаем слово. Прибавляем к очкам. Как найти следующее слово и не повториться?
// слово это вектор от ху до ху.
// слова проверяем только для тех букв, которые не ходятся внутри этих векторов. Но только по
// горзизонтали. Слова по вертикали ищем только после того,как нашли все слова по горизонтали.
function getHorizontalWords(board, previousBoard) {
  return board.reduce((boardWords, row, yIndex) => {
    return boardWords.concat(
      row.reduce((lineWords, cell, xIndex) => {
        if (
          cell !== previousBoard[yIndex][xIndex] &&
          // this cell is not counted in words yet
          !lineWords.find(
            word =>
              word.y == yIndex && word.x <= xIndex && word.x + word.len > xIndex
          )
        ) {
          // start to search for the beginning of the word
          // move left while xIndex < 0 or cell is empty
          let leftIndex = xIndex;
          while (true) {
            leftIndex--;
            if (
              leftIndex < 0 ||
              (!board[yIndex][leftIndex] && !previousBoard[yIndex][leftIndex])
            ) {
              leftIndex++;
              break;
            }
          }
          // move right till xIndex >= 15 or cell is empty
          let rightIndex = xIndex;
          while (true) {
            rightIndex++;
            if (
              rightIndex >= row.length ||
              (!board[yIndex][rightIndex] && !previousBoard[yIndex][rightIndex])
            ) {
              break;
            }
          }
          const len = rightIndex - leftIndex;
          if (len >= 2) {
            lineWords.push({
              y: yIndex,
              x: leftIndex,
              len: len,
              word: board[yIndex].slice(leftIndex, rightIndex)
            });
          }
        }
        return lineWords;
      }, [])
    );
  }, []);
}

function rotate(board) {
  return Array(15)
    .fill(null)
    .map((_, index) => board.map(row => row[index]));
}

function countWordScore(wordMultiplier, wordObject, previousBoard) {
  return (
    wordMultiplier *
    wordObject.word.reduce((wordScore, letter, index) => {
      let letterMultiplier = 1;
      if (
        letterBonuses[wordObject.y] &&
        letterBonuses[wordObject.y][wordObject.x + index] &&
        // check if it is not a letter of previous player
        !previousBoard[wordObject.y][wordObject.x + index]
      ) {
        letterMultiplier = letterBonuses[wordObject.y][wordObject.x + index];
      }
      return wordScore + values[letter] * letterMultiplier;
    }, 0)
  );
}

function turnWordsAndScore(board, previousBoard, bonus15) {
  const horizontalWords = getHorizontalWords(board, previousBoard);
  const rotatedBoard = rotate(board);
  const rotatedPreviousBoard = rotate(previousBoard);
  const verticalWords = getHorizontalWords(rotatedBoard, rotatedPreviousBoard);
  const horizontalTurn = horizontalWords.reduce(
    (turn, wordObject) => {
      let wordMultiplier = 0;
      for (let i = wordObject.x; i < wordObject.x + wordObject.len; i++) {
        if (
          wordBonuses[wordObject.y] &&
          wordBonuses[wordObject.y][i] &&
          // check if it is not a letter of previous player
          !previousBoard[wordObject.y][i]
        ) {
          wordMultiplier += wordBonuses[wordObject.y][i];
        }
      }
      if (wordMultiplier === 0) {
        wordMultiplier = 1;
      }
      const wordScore = countWordScore(
        wordMultiplier,
        wordObject,
        previousBoard
      );
      turn.score += wordScore;
      turn.words.push({ [wordObject.word.join("")]: wordScore });
      return turn;
    },
    { words: [], score: 0 }
  );
  const verticalTurn = verticalWords.reduce(
    (turn, wordObject) => {
      let wordMultiplier = 0;
      for (let i = wordObject.x; i < wordObject.x + wordObject.len; i++) {
        if (
          wordBonuses[wordObject.y] &&
          wordBonuses[wordObject.y][i] &&
          // check if it is not a letter of previous player
          !rotate(previousBoard)[wordObject.y][i]
        ) {
          wordMultiplier += wordBonuses[wordObject.y][i];
        }
      }
      if (wordMultiplier === 0) {
        wordMultiplier = 1;
      }
      const wordScore = countWordScore(
        wordMultiplier,
        wordObject,
        rotate(previousBoard)
      );
      turn.score += wordScore;
      turn.words.push({ [wordObject.word.join("")]: wordScore });
      return turn;
    },
    { words: [], score: 0 }
  );
  let bonus = 0;
  if (bonus15) {
    bonus += 15;
  }
  const turn = {
    words: horizontalTurn.words.concat(verticalTurn.words),
    score: horizontalTurn.score + verticalTurn.score + bonus
  };
  return turn;
}

// extract letters from all letters
function substract(arr, subarr) {
  const tempSubarr = subarr.slice().sort();
  const tempArr = arr.slice().sort();
  return tempArr.reduce(
    (acc, letter) => {
      if (acc.i === tempSubarr.length) {
        acc.letters.push(letter);
        return acc;
      }
      if (letter === tempSubarr[acc.i]) {
        acc.i++;
        return acc;
      }
      acc.letters.push(letter);
      return acc;
    },
    { i: 0, letters: [] }
  ).letters;
}

function giveLetters(bag, userLetters, lettersToChange) {
  const tempBag = shuffle(bag.slice().concat(lettersToChange));
  const requiredQty = lettersToChange.length;
  let newLetters = [];
  while (newLetters.length !== requiredQty) {
    newLetters.push(
      tempBag.splice(Math.floor(Math.random() * tempBag.length), 1)[0]
    );
  }
  const updatedUserLetters = userLetters.concat(newLetters);
  return { bag: tempBag, userLetters: updatedUserLetters };
}

function getResult(score, turns, userIds) {
  const winScore = Object.keys(score).reduce(
    (acc, user) => {
      if (score[user] > 0 && score[user] > acc[0].score) {
        acc = [{ score: score[user], user: user }];
      } else if (score[user] === acc[0].score) {
        acc.push({ score: score[user], user: user });
      }
      return acc;
    },
    [{ score: 0 }]
  );
  let winner = [];
  if (winScore[0].score > 0) {
    winner = winScore.map(el => el.user);
  }
  const longestWord = turns.reduce((acc, turn) => {
    turn.words.forEach(word => {
      if (
        acc.length === 0 ||
        Object.keys(word)[0].length > acc[0].word.length
      ) {
        acc = [{ word: Object.keys(word)[0], user: turn.user }];
      } else if (Object.keys(word)[0].length === acc[0].word.length) {
        acc.push({ word: [Object.keys(word)[0]], user: turn.user });
      }
    });
    return acc;
  }, []);
  const maxScoreWord = turns.reduce((acc, turn) => {
    turn.words.forEach(word => {
      if (acc.length === 0 || Object.values(word)[0] > acc[0].value) {
        acc = [
          {
            word: Object.keys(word)[0],
            value: Object.values(word)[0],
            user: turn.user
          }
        ];
      } else if (Object.values(word)[0] === acc[0].value) {
        acc.push({
          word: [Object.keys(word)[0]],
          value: Object.values(word)[0],
          user: turn.user
        });
      }
    });
    return acc;
  }, []);
  const bestTurnByCount = turns.reduce((acc, turn) => {
    if (acc.length === 0 || turn.words.length > acc[0].qty) {
      acc = [{ qty: turn.words.length, turn, user: turn.user }];
    } else if (turn.words.length === acc[0].qty) {
      acc.push({ qty: turn.words.length, turn, user: turn.user });
    }
    return acc;
  }, []);
  const bestTurnByValue = turns.reduce((acc, turn) => {
    if (acc.length === 0 || turn.score > acc[0].score) {
      acc = [{ score: turn.score, turn, user: turn.user }];
    } else if (turn.score === acc[0].score) {
      acc.push({ score: turn.score, turn, user: turn.user });
    }
    return acc;
  }, []);

  const neverChangedLetters = userIds.filter(
    user => !turns.some(turn => turn.changedLetters && turn.user === user)
  );
  return {
    winner,
    longestWord,
    maxScoreWord,
    bestTurnByCount,
    bestTurnByValue,
    neverChangedLetters
  };
}

function factory(stream, roomStream) {
  const router = new Router();

  router.post("/start", authMiddleware, async (req, res, nxt) => {
    roomId = req.body.roomId;
    try {
      const currentRoom = await room.findByPk(roomId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: {
              exclude: ["password", "createdAt", "updatedAt"]
            }
          },
          {
            model: game,
            required: false,
            attributes: {
              exclude: ["letters", "board", "previousBoard", "putLetters"]
            },
            where: {
              phase: {
                [sequelize.Op.not]: "finished"
              }
            }
          }
        ]
      });
      // create new game only if there is no unfinished game in this room
      if (currentRoom.games.length === 0) {
        const turnOrder = shuffle(currentRoom.users.map(user => user.id));

        // give letters to players
        const lettersForGame = shuffle(originalLetters);
        let acc = { pot: lettersForGame.slice() };
        const letters = currentRoom.users.reduce((acc, user) => {
          if (!acc[user.id]) {
            acc[user.id] = [];
          }
          while (acc[user.id].length !== 7) {
            acc[user.id].push(
              acc.pot.splice(Math.floor(Math.random() * acc.pot.length), 1)[0]
            );
          }
          return acc;
        }, acc);
        const score = currentRoom.users.reduce((acc, user) => {
          acc[user.id] = 0;
          return acc;
        }, {});
        const currentGame = await game.create({
          turnOrder,
          letters,
          roomId,
          score,
          turns: [],
          result: {}
        });
        await currentGame.setUsers(currentRoom.users);
        await currentRoom.update({ phase: "started" });
        const action = {
          type: "GAME_UPDATED",
          payload: { gameId: currentGame.id, currentGame }
        };
        const string = JSON.stringify(action);
        stream.send(string);
        // this response is important
        res.send(currentGame);
      }

      const updatedRoom = await room.findByPk(roomId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: {
              exclude: ["password", "createdAt", "updatedAt"]
            }
          },
          {
            model: game,
            required: false,
            attributes: {
              exclude: ["letters", "board", "previousBoard", "putLetters"]
            },
            where: {
              phase: {
                [sequelize.Op.not]: "finished"
              }
            }
          }
        ]
      });

      updatedRoom.dataValues.game = updatedRoom.dataValues.games[0];
      delete updatedRoom.dataValues.games;
      const action2 = {
        type: "UPDATED_ROOM",
        payload: updatedRoom
      };
      const string2 = JSON.stringify(action2);
      roomStream.send(string2);
    } catch (error) {
      nxt(error);
    }
  });

  router.get("/game/:id", async (req, res, next) => {
    const gameId = req.params.id;
    try {
      const currentGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: {
              exclude: ["password", "createdAt", "updatedAt"]
            }
          }
        ]
      });
      const action = {
        type: "GAME_UPDATED",
        payload: { gameId: gameId, game: currentGame }
      };
      const string = JSON.stringify(action);
      stream.updateInit(string);
      stream.init(req, res);
      stream.send(string);
    } catch (error) {
      next(error);
    }
  });

  //turn of the game
  router.post("/game/:id/turn", authMiddleware, async (req, res, next) => {
    // get user from authmiddleware
    const currentUser = req.user;
    const gameId = req.params.id;
    const userBoard = req.body.userBoard;
    try {
      const currentGame = await game.findByPk(gameId, {
        include: room
      });
      // check if game is in turn phase and if it is current user's turn
      if (
        currentGame.phase === "turn" &&
        currentGame.turnOrder[currentGame.turn] === currentUser.id
      ) {
        //check if user passed
        if (!userBoard.some(row => row.some(letter => letter))) {
          // copy game board to previous board
          // change game phase to next turn, no need to validate pass
          // change passedCount qty
          const newPassedQty = currentGame.passedCount + 1;
          if (newPassedQty === currentGame.turnOrder.length * 2) {
            let result = currentGame.result;
            if (currentGame.turns.length !== 0) {
              result = getResult(
                currentGame.score,
                currentGame.turns,
                currentGame.turnOrder
              );
            }
            await currentGame.update({
              phase: "finished",
              passedCount: newPassedQty,
              lettersChanged: false,
              result,
              turns: [
                ...currentGame.turns,
                {
                  words: [],
                  score: 0,
                  user: currentUser.id,
                  changedLetters: false
                }
              ]
            });
            await currentGame.room.update({
              phase: "ready"
            });
            const updatedRoom = await room.findByPk(currentGame.roomId, {
              include: [
                {
                  model: user,
                  as: "users",
                  attributes: {
                    exclude: ["password", "createdAt", "updatedAt"]
                  }
                },
                game
              ]
            });
            const action2 = {
              type: "UPDATED_ROOM",
              payload: updatedRoom
            };
            const string2 = JSON.stringify(action2);
            stream.send(string2);
          } else {
            await currentGame.update({
              previousBoard: currentGame.board,
              phase: "turn",
              turn: getNextTurn(currentGame),
              passedCount: newPassedQty,
              validated: "unknown",
              turns: [
                ...currentGame.turns,
                {
                  words: [],
                  score: 0,
                  user: currentUser.id,
                  changedLetters: false
                }
              ]
            });
          }
        } else {
          // check if all letters in turn were i user's hand
          // TODO: take possible duplicates into account
          // TODO: rewrite, remove returns
          if (
            userBoard.some(row =>
              row.some(
                letter =>
                  letter !== null &&
                  !currentGame.letters[currentUser.id].includes(letter)
              )
            )
          ) {
            return next(`Invalid letters used`);
          }
          // check if all letters are placed on empty cells
          if (
            userBoard.some((row, y) =>
              row.some(
                (letter, x) =>
                  letter !== null && currentGame.board[y][x] !== null
              )
            )
          ) {
            return next("Cell is already occupied");
          }
          // add user letters to current board
          const newBoard = currentGame.board.map((row, y) =>
            row.map((cell, x) => {
              if (cell === null && userBoard[y][x] !== null) {
                return userBoard[y][x];
              } else {
                return cell;
              }
            })
          );

          // remove those letters from user hand
          const putLetters = userBoard.reduce((acc, row) => {
            return acc.concat(
              row.reduce((accum, cell) => {
                if (cell) {
                  accum.push(cell);
                }
                return accum;
              }, [])
            );
          }, []);

          // extract put letters from all letters
          const keepLetters = substract(
            currentGame.letters[currentUser.id],
            putLetters
          );
          const updatedLetters = {
            ...currentGame.letters,
            [currentUser.id]: keepLetters
          };
          // copy game board to previous board
          // change game phase to validation
          // return passedCount to 0
          await currentGame.update({
            previousBoard: currentGame.board,
            board: newBoard,
            phase: "validation",
            letters: updatedLetters,
            putLetters: putLetters,
            passedCount: 0,
            validated: "unknown",
            lettersChanged: false
          });
        }
      }

      // fetch game from db
      const updatedGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: {
              exclude: ["password", "createdAt", "updatedAt"]
            }
          }
        ]
      });
      const action = {
        type: "GAME_UPDATED",
        payload: { gameId: gameId, game: updatedGame }
      };
      const string = JSON.stringify(action);
      res.send(JSON.stringify(updatedGame.id));
      stream.send(string);
    } catch (error) {
      next(error);
    }
  });

  router.post("/game/:id/approve", authMiddleware, async (req, res, next) => {
    // get user from authmiddleware
    const currentUser = req.user;
    const gameId = req.params.id;
    const validation = req.body.validation;

    try {
      const currentGame = await game.findByPk(gameId);
      const newTurn = getNextTurn(currentGame);
      // check if it is right phase and user to validate
      // only user who's turn is next, can validate the turn
      if (
        (currentGame.phase === "validation",
        currentGame.turnOrder.includes(currentUser.id) &&
          currentUser.id === currentGame.turnOrder[newTurn])
      ) {
        if (validation === "yes") {
          const currentTurnUserId = currentGame.turnOrder[currentGame.turn];
          const bonus15 = currentGame.letters[currentTurnUserId].length === 0;
          const turn = turnWordsAndScore(
            currentGame.board,
            currentGame.previousBoard,
            bonus15
          );
          const updatedScore = {
            ...currentGame.score,
            [currentTurnUserId]: (currentGame.score[currentTurnUserId] +=
              turn.score)
          };
          let updatedTurns = currentGame.turns;
          // this condition is required because previously created games don't contain turns object
          if (currentGame.turns) {
            updatedTurns = [
              ...currentGame.turns,
              { ...turn, user: currentTurnUserId, changedLetters: false }
            ];
          }
          const updatedGameLetters = updateGameLetters(currentGame);
          await currentGame.update({
            phase: "turn",
            turn: newTurn,
            letters: updatedGameLetters,
            putLetters: [],
            score: updatedScore,
            validated: "yes",
            turns: updatedTurns
          });
        } else if (validation === "no") {
          await currentGame.update({
            validated: "no"
          });
        }
      }
      const updatedGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: {
              exclude: ["password", "createdAt", "updatedAt"]
            }
          }
        ]
      });
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId: gameId,
          game: updatedGame
        }
      };
      const string = JSON.stringify(action);
      res.send(JSON.stringify(updatedGame.id));
      stream.send(string);
    } catch (error) {
      next(error);
    }
  });

  router.post("/game/:id/undo", authMiddleware, async (req, res, next) => {
    // get user from authmiddleware
    const currentUser = req.user;
    const gameId = req.params.id;
    try {
      const currentGame = await game.findByPk(gameId);
      // user can only undo own turn
      if (
        currentGame.phase === "validation" &&
        currentGame.turnOrder.includes(currentUser.id) &&
        currentUser.id === currentGame.turnOrder[currentGame.turn]
      ) {
        await currentGame.update({
          board: currentGame.previousBoard,
          phase: "turn",
          letters: {
            ...currentGame.letters,
            [currentUser.id]: currentGame.letters[currentUser.id].concat(
              currentGame.putLetters
            )
          },
          putLetters: []
        });
      }

      const updatedGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: {
              exclude: ["password", "createdAt", "updatedAt"]
            }
          }
        ]
      });
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId: gameId,
          game: updatedGame
        }
      };
      const string = JSON.stringify(action);
      res.send(JSON.stringify(updatedGame.id));
      stream.send(string);
    } catch (error) {
      next(error);
    }
  });

  router.post("/game/:id/change", authMiddleware, async (req, res, next) => {
    // get user from authmiddleware
    const currentUser = req.user;
    const gameId = req.params.id;
    const lettersToChange = req.body.letters;
    try {
      const currentGame = await game.findByPk(gameId);
      // user can exchange letters only in his turn
      if (
        currentGame.phase === "turn" &&
        currentGame.turnOrder.includes(currentUser.id) &&
        currentUser.id === currentGame.turnOrder[currentGame.turn]
      ) {
        //check if user exchanges his own letters

        // substract letters to change
        const previousUserLetters = currentGame.letters[currentUser.id];
        const remainingLetters = substract(
          previousUserLetters,
          lettersToChange
        );
        // give new letters to user
        const updatedBagAndUserLetters = giveLetters(
          currentGame.letters.pot,
          remainingLetters,
          lettersToChange
        );
        const updatedUserLetters = updatedBagAndUserLetters.userLetters;
        const updatedPot = updatedBagAndUserLetters.bag;

        await currentGame.update({
          previousBoard: currentGame.board,
          phase: "turn",
          turn: getNextTurn(currentGame),
          letters: {
            ...currentGame.letters,
            pot: updatedPot,
            [currentUser.id]: updatedUserLetters
          },
          putLetters: [],
          lettersChanged: true,
          turns: [
            ...currentGame.turns,
            { words: [], score: 0, user: currentUser.id, changedLetters: true }
          ]
        });
      }
      const updatedGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: {
              exclude: ["password", "createdAt", "updatedAt"]
            }
          }
        ]
      });
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId: gameId,
          game: updatedGame
        }
      };
      const string = JSON.stringify(action);
      res.send(JSON.stringify(updatedGame.id));
      stream.send(string);
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = factory;
