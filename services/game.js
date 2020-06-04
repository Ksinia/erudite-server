const { wordBonuses, letterBonuses } = require("../constants/bonuses");

const shuffle = (arr) => {
  return arr.sort(() => Math.random() - 0.5);
};

const getNextTurn = (game) => {
  return (game.turn + 1) % game.turnOrder.length;
};

const updateGameLetters = (game) => {
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
    [currentUserId]: updatedUserLetters,
  };
  return updatedGameLetters;
};
// как найти слово? Находим букву, двигаемся влево от нее по обеим доскам, пока не найдем пустую
// клетку. Затем двигаемся вправо от нее по обеим доскам пока не найдем пустую клетку. Если
// между пустыми клетками 1 клетка, то это не слово. В противном случае - слово. Проверяем,
// на что умножать слово. Добавляем стоимость всех букв, проверяя умножение каждой буквы.
// умножаем слово. Прибавляем к очкам. Как найти следующее слово и не повториться?
// слово это вектор от ху до ху.
// слова проверяем только для тех букв, которые не ходятся внутри этих векторов. Но только по
// горзизонтали. Слова по вертикали ищем только после того,как нашли все слова по горизонтали.
const getHorizontalWords = (board, previousBoard) => {
  return board.reduce((boardWords, row, yIndex) => {
    return boardWords.concat(
      row.reduce((lineWords, cell, xIndex) => {
        if (
          cell &&
          !previousBoard[yIndex][xIndex] &&
          // this cell is not counted in words yet
          !lineWords.find(
            (word) =>
              word.y == yIndex && word.x <= xIndex && word.x + word.len > xIndex
          )
        ) {
          // start to search for the beginning of the word
          // move left while xIndex < 0 or cell is empty
          let leftIndex = xIndex;
          //indefinite loop
          for (;;) {
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
          //indefinite loop
          for (;;) {
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
              word: board[yIndex].slice(leftIndex, rightIndex),
            });
          }
        }
        return lineWords;
      }, [])
    );
  }, []);
};

const rotate = (board) => {
  return Array(15)
    .fill(null)
    .map((_, index) => board.map((row) => row[index]));
};

const countWordScore = (wordMultiplier, wordObject, previousBoard, values) => {
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
      return wordScore + values[letter[0]] * letterMultiplier;
    }, 0)
  );
};

const turnWordsAndScore = (board, previousBoard, bonus15, values) => {
  const horizontalWords = getHorizontalWords(board, previousBoard);
  const rotatedBoard = rotate(board);
  const rotatedPreviousBoard = rotate(previousBoard);
  const verticalWords = getHorizontalWords(rotatedBoard, rotatedPreviousBoard);
  const horizontalTurn = getHorizontalOrVerticalTurn(
    horizontalWords,
    previousBoard,
    values
  );
  const verticalTurn = getHorizontalOrVerticalTurn(
    verticalWords,
    rotatedPreviousBoard,
    values
  );
  let bonus = 0;
  if (bonus15) {
    bonus += 15;
  }
  const turn = {
    words: horizontalTurn.words.concat(verticalTurn.words),
    score: horizontalTurn.score + verticalTurn.score + bonus,
  };
  return turn;
};

// extract letters from all letters
const substract = (arr, subarr) => {
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
};

const giveLetters = (bag, userLetters, lettersToChange) => {
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
};

const getResult = (score, turns, userIds) => {
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
    winner = winScore.map((el) => el.user);
  }
  const longestWord = turns.reduce((acc, turn) => {
    turn.words.forEach((word) => {
      if (
        acc.length === 0 ||
        Object.keys(word)[0].replace(/\*/gi, "").length > acc[0].word.length
      ) {
        acc = [
          { word: Object.keys(word)[0].replace(/\*/gi, ""), user: turn.user },
        ];
      } else if (
        Object.keys(word)[0].replace(/\*/gi, "").length === acc[0].word.length
      ) {
        acc.push({
          word: [Object.keys(word)[0].replace(/\*/gi, "")],
          user: turn.user,
        });
      }
    });
    return acc;
  }, []);
  const maxScoreWord = turns.reduce((acc, turn) => {
    turn.words.forEach((word) => {
      if (acc.length === 0 || Object.values(word)[0] > acc[0].value) {
        acc = [
          {
            word: Object.keys(word)[0].replace(/\*/gi, ""),
            value: Object.values(word)[0],
            user: turn.user,
          },
        ];
      } else if (Object.values(word)[0] === acc[0].value) {
        acc.push({
          word: [Object.keys(word)[0]].replace(/\*/gi, ""),
          value: Object.values(word)[0],
          user: turn.user,
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
    (user) => !turns.some((turn) => turn.changedLetters && turn.user === user)
  );
  return {
    winner,
    longestWord,
    maxScoreWord,
    bestTurnByCount,
    bestTurnByValue,
    neverChangedLetters,
  };
};

const getHorizontalOrVerticalTurn = (
  horizontalWords,
  previousBoard,
  values
) => {
  return horizontalWords.reduce(
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
        previousBoard,
        values
      );
      turn.score += wordScore;
      turn.words.push({
        [wordObject.word.join("")]: wordScore,
      });
      return turn;
    },
    { words: [], score: 0 }
  );
};

module.exports = {
  shuffle,
  getNextTurn,
  updateGameLetters,
  getHorizontalWords,
  rotate,
  turnWordsAndScore,
  substract,
  giveLetters,
  getResult,
};
