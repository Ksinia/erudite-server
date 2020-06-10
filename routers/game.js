const { Router } = require("express");
const authMiddleware = require("../auth/middleware");
const { user, game } = require("../models");
const lettersSets = require("../constants/letterSets");
const {
  shuffle,
  getNextTurn,
  updateGameLetters,
  getHorizontalWords,
  rotate,
  turnWordsAndScore,
  substract,
  giveLetters,
  getResult,
} = require("../services/game");

function factory(gameStream, lobbyStream) {
  const router = new Router();

  router.post("/create", authMiddleware, async (req, res, next) => {
    const currentUser = req.user;
    const { maxPlayers, language } = req.body;
    try {
      const currentGame = await game.create({ maxPlayers, language });
      const newGameId = currentGame.id;
      let players = [];
      let phase = "waiting";
      if (req.body.players) {
        players = await user.findAll({
          where: {
            id: req.body.players,
          },
        });
        phase = "ready";
      } else {
        players = [currentUser];
      }
      await currentGame.setUsers(players);
      await currentGame.update({ phase });
      const updatedGame = await game.findByPk(newGameId, {
        attributes: [
          "id",
          "phase",
          "turnOrder",
          "turn",
          "validated",
          "language",
          "maxPlayers",
        ],
        include: [
          {
            model: user,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      const action = {
        type: "NEW_GAME",
        payload: updatedGame,
      };
      const string = JSON.stringify(action);

      lobbyStream.send(string);
      res.send(updatedGame);
    } catch (error) {
      next(error);
    }
  });

  router.put("/join", authMiddleware, async (req, res, next) => {
    const currentUser = req.user;
    const gameId = req.body.gameId;
    try {
      const currentGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      const updatedUsers = currentGame.users.concat([currentUser]);
      if (updatedUsers.length === currentGame.maxPlayers) {
        await currentGame.update({
          phase: "ready",
        });
      }
      await currentGame.setUsers(updatedUsers);
      const updatedGame = await game.findByPk(gameId, {
        attributes: [
          "id",
          "phase",
          "turnOrder",
          "turn",
          "validated",
          "language",
          "maxPlayers",
        ],
        include: [
          {
            model: user,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      const actionForLobby = {
        type: "UPDATED_GAME_IN_LOBBY",
        payload: updatedGame,
      };
      const actionForLobbyString = JSON.stringify(actionForLobby);
      lobbyStream.send(actionForLobbyString);
      const actionForGame = {
        type: "GAME_UPDATED",
        payload: { gameId, game: updatedGame },
      };
      const actionForGameString = JSON.stringify(actionForGame);
      gameStream.send(actionForGameString);
      res.send(actionForGameString);
    } catch (error) {
      next(error);
    }
  });

  router.post("/start", authMiddleware, async (req, res, nxt) => {
    const gameId = req.body.gameId;
    try {
      const currentGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      const turnOrder = shuffle(currentGame.users.map((user) => user.id));
      const set = lettersSets[currentGame.language].letters;
      // give letters to players
      const lettersForGame = shuffle(set);
      let acc = { pot: lettersForGame.slice() };
      const letters = currentGame.users.reduce((acc, user) => {
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
      const score = currentGame.users.reduce((acc, user) => {
        acc[user.id] = 0;
        return acc;
      }, {});
      await currentGame.update({
        turnOrder,
        letters,
        score,
        turns: [],
        result: {},
        phase: "turn",
      });
      const action = {
        type: "GAME_UPDATED",
        payload: { gameId, game: currentGame },
      };
      const string = JSON.stringify(action);
      gameStream.send(string);
      // this response is important
      res.send(currentGame);

      const updatedGameForLobby = await game.findByPk(gameId, {
        attributes: [
          "id",
          "phase",
          "turnOrder",
          "turn",
          "validated",
          "language",
          "maxPlayers",
        ],
        include: [
          {
            model: user,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });

      const action2 = {
        type: "UPDATED_GAME_IN_LOBBY",
        payload: updatedGameForLobby,
      };
      const string2 = JSON.stringify(action2);
      lobbyStream.send(string2);
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
            attributes: ["id", "name"],
          },
        ],
      });
      const action = {
        type: "GAME_UPDATED",
        payload: { gameId, game: currentGame },
      };
      const string = JSON.stringify(action);
      gameStream.init(req, res);
      gameStream.send(string);
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
    const wildCardOnBoard = req.body.wildCardOnBoard;
    try {
      const currentGame = await game.findByPk(gameId);
      // check if game is in turn phase and if it is current user's turn
      if (
        currentGame.phase === "turn" &&
        currentGame.turnOrder[currentGame.turn] === currentUser.id
      ) {
        //check if user passed
        if (!userBoard.some((row) => row.some((letter) => letter))) {
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
                  changedLetters: false,
                },
              ],
            });
            const action2 = {
              type: "DELETE_GAME_IN_LOBBY",
              payload: gameId,
            };
            const string2 = JSON.stringify(action2);
            lobbyStream.send(string2);
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
                  changedLetters: false,
                },
              ],
            });
          }
        } else {
          // user didn't pass
          let userLetters = currentGame.letters[currentUser.id].slice();
          let currentGameBoard = currentGame.board.map((row) => row.slice());
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
          const allowedChangedWildCardQty =
            usedWildCardsQty - wildCardsInHandQty;
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
                  (letter, x) =>
                    letter !== null && currentGame.board[y][x] !== null
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
              const hWords = getHorizontalWords(
                newBoard,
                currentGame.board
              ).map((wordObject) =>
                wordObject.word
                  .map((letter) => {
                    if (letter[0] === "*") {
                      return letter[1];
                    } else {
                      return letter;
                    }
                  })
                  .join("")
              );
              const words = hWords.concat(
                getHorizontalWords(
                  rotate(newBoard),
                  rotate(currentGame.board)
                ).map((wordObject) =>
                  wordObject.word
                    .map((letter) => {
                      if (letter[0] === "*") {
                        return letter[1];
                      } else {
                        return letter;
                      }
                    })
                    .join("")
                )
              );

              const duplicatedWords = words.filter((word) => {
                return currentGame.turns.some((turn) => {
                  if (turn.words.length > 0) {
                    const listOfWords = turn.words.map((wordObject) =>
                      Object.keys(wordObject)[0].replace(/\*/gi, "")
                    );
                    return listOfWords.includes(word);
                  }
                });
              });
              if (duplicatedWords && duplicatedWords.length > 0) {
                const action = {
                  type: "DUPLICATED_WORDS",
                  payload: duplicatedWords,
                };
                res.send(JSON.stringify(action));
                return;
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
                  ...currentGame.letters,
                  [currentUser.id]: keepLetters,
                };
                // copy game board to previous board
                // change game phase to validation
                // do not need to return passedCount to 0,
                // because the turn may me undone
                await currentGame.update({
                  previousBoard: currentGame.board,
                  board: newBoard,
                  phase: "validation",
                  letters: updatedLetters,
                  // putLetters: putLetters,
                  previousLetters: currentGame.letters[currentUser.id],
                  validated: "unknown",
                  lettersChanged: false,
                  wordsForValidation: words,
                });
              }
            }
          }
          // }
        }
      }
      // fetch game from db
      const updatedGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      const streamAction = {
        type: "GAME_UPDATED",
        payload: { gameId, game: updatedGame },
      };
      const responseAction = {
        type: "NO_DUPLICATIONS",
      };
      res.send(JSON.stringify(responseAction));
      gameStream.send(JSON.stringify(streamAction));
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
          const values = lettersSets[currentGame.language].values;
          const turn = turnWordsAndScore(
            currentGame.board,
            currentGame.previousBoard,
            bonus15,
            values
          );
          const updatedScore = {
            ...currentGame.score,
            [currentTurnUserId]: (currentGame.score[currentTurnUserId] +=
              turn.score),
          };
          let updatedTurns = currentGame.turns;
          // this condition is required because previously created games don't contain turns object
          if (currentGame.turns) {
            updatedTurns = [
              ...currentGame.turns,
              { ...turn, user: currentTurnUserId, changedLetters: false },
            ];
          }
          const updatedGameLetters = updateGameLetters(currentGame);
          await currentGame.update({
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
          await currentGame.update({
            validated: "no",
          });
        }
      }
      const updatedGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      const string = JSON.stringify(action);
      res.send(JSON.stringify(updatedGame.id));
      gameStream.send(string);
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
        if (
          currentGame.previousLetters &&
          currentGame.previousLetters.length > 0
        ) {
          await currentGame.update({
            board: currentGame.previousBoard,
            phase: "turn",
            letters: {
              ...currentGame.letters,
              [currentUser.id]: currentGame.previousLetters,
            },
            putLetters: [],
            previousLetters: [],
          });
        } else {
          // TODO: get rid of all operations with putLetters in db
          await currentGame.update({
            board: currentGame.previousBoard,
            phase: "turn",
            letters: {
              ...currentGame.letters,
              [currentUser.id]: currentGame.letters[currentUser.id].concat(
                currentGame.putLetters
              ),
            },
            putLetters: [],
          });
        }
      }

      const updatedGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      const string = JSON.stringify(action);
      res.send(JSON.stringify(updatedGame.id));
      gameStream.send(string);
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
            [currentUser.id]: updatedUserLetters,
          },
          putLetters: [],
          previousLetters: [],
          lettersChanged: true,
          turns: [
            ...currentGame.turns,
            { words: [], score: 0, user: currentUser.id, changedLetters: true },
          ],
        });
      }
      const updatedGame = await game.findByPk(gameId, {
        include: [
          {
            model: user,
            as: "users",
            attributes: ["id", "name"],
          },
        ],
      });
      const action = {
        type: "GAME_UPDATED",
        payload: {
          gameId,
          game: updatedGame,
        },
      };
      const string = JSON.stringify(action);
      res.send(JSON.stringify(updatedGame.id));
      gameStream.send(string);
    } catch (error) {
      next(error);
    }
  });
  return router;
}

module.exports = factory;
