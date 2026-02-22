import { letterBonuses, wordBonuses } from "../constants/bonuses.js";
import { notify } from "./notifications.js";

export const BALANCED_USER_ID = 3;

const VOWELS = new Set([
  "а", "е", "и", "о", "у", "э", "ю", "я", "ы",
  "a", "e", "i", "o", "u",
]);
const NEUTRAL_LETTERS = new Set(["*", "ъ", "ь"]);

export const shuffle = (arr) => {
  return arr.sort(() => Math.random() - 0.5);
};

export const drawBalancedLetters = (pot, count, existingLetters = []) => {
  const n = Math.min(count, pot.length);
  if (n <= 0) return [];

  let handVowels = 0;
  let handCons = 0;
  existingLetters.forEach((letter) => {
    if (VOWELS.has(letter)) handVowels++;
    else if (!NEUTRAL_LETTERS.has(letter)) handCons++;
  });

  const vowelIdx = [];
  const consIdx = [];
  const neutralIdx = [];
  pot.forEach((letter, i) => {
    if (NEUTRAL_LETTERS.has(letter)) neutralIdx.push(i);
    else if (VOWELS.has(letter)) vowelIdx.push(i);
    else consIdx.push(i);
  });

  shuffle(vowelIdx);
  shuffle(consIdx);
  shuffle(neutralIdx);

  const totalLetters = existingLetters.length + n;
  const potTotal = vowelIdx.length + consIdx.length + neutralIdx.length;
  const potVowelRatio = potTotal > 0 ? vowelIdx.length / potTotal : 0.5;
  const targetTotalV = Math.round(totalLetters * Math.max(potVowelRatio, 2 / 7));
  let wantV = Math.max(0, Math.min(targetTotalV - handVowels, n));
  let wantC = n - wantV;

  wantV = Math.min(wantV, vowelIdx.length);
  wantC = Math.min(wantC, consIdx.length);
  if (wantV + wantC < n) wantV = Math.min(n - wantC, vowelIdx.length);
  if (wantV + wantC < n) wantC = Math.min(n - wantV, consIdx.length);

  const picked = [
    ...vowelIdx.slice(0, wantV),
    ...consIdx.slice(0, wantC),
    ...neutralIdx.slice(0, n - wantV - wantC),
  ];

  if (picked.length < n) {
    const used = new Set(picked);
    const rest = [];
    for (let i = 0; i < pot.length; i++) {
      if (!used.has(i)) rest.push(i);
    }
    shuffle(rest);
    picked.push(...rest.slice(0, n - picked.length));
  }

  picked.sort((a, b) => b - a);
  return picked.map((i) => pot.splice(i, 1)[0]);
};

export const getNextTurn = (game) => {
  return (game.turn + 1) % game.turnOrder.length;
};

export const updateGameLetters = (game) => {
  const currentUserId = game.turnOrder[game.turn];
  const currentUserLetters = game.letters[currentUserId];
  let requiredQty = 7 - currentUserLetters.length;
  if (game.letters.pot.length < requiredQty) {
    requiredQty = game.letters.pot.length;
  }
  let newLetters;
  if (currentUserId === BALANCED_USER_ID) {
    newLetters = drawBalancedLetters(game.letters.pot, requiredQty, currentUserLetters);
  } else {
    newLetters = [];
    while (newLetters.length !== requiredQty) {
      newLetters.push(
        game.letters.pot.splice(
          Math.floor(Math.random() * game.letters.pot.length),
          1
        )[0]
      );
    }
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
export const getHorizontalWords = (board, previousBoard) => {
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

export const getWords = (newBoard, oldBoard) => {
  const hWords = getHorizontalWords(newBoard, oldBoard).map((wordObject) =>
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
  return hWords.concat(
    getHorizontalWords(rotate(newBoard), rotate(oldBoard)).map((wordObject) =>
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
};

export const rotate = (board) => {
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

export const turnWordsAndScore = (board, previousBoard, bonus15, values) => {
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
export const subtract = (arr, subarr) => {
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

export const giveLetters = (bag, userLetters, lettersToChange, userId?) => {
  const tempBag = shuffle(bag.slice().concat(lettersToChange));
  const requiredQty = lettersToChange.length;
  let newLetters;
  if (userId === BALANCED_USER_ID) {
    newLetters = drawBalancedLetters(tempBag, requiredQty, userLetters);
  } else {
    newLetters = [];
    while (newLetters.length !== requiredQty) {
      newLetters.push(
        tempBag.splice(Math.floor(Math.random() * tempBag.length), 1)[0]
      );
    }
  }
  const updatedUserLetters = userLetters.concat(newLetters);
  return { bag: tempBag, userLetters: updatedUserLetters };
};

export const getResult = (score, turns, userIds) => {
  const winScore = Object.keys(score).reduce(
    (acc, user) => {
      if (score[user] > 0 && score[user] > acc[0].score) {
        acc = [{ score: score[user], user: user }];
      } else if (score[user] === acc[0].score) {
        acc.push({ score: score[user], user: user });
      }
      return acc;
    },
    [{ score: 0 } as { score: number; user: string }]
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
          word: Object.keys(word)[0].replace(/\*/gi, ""),
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
          word: Object.keys(word)[0].replace(/\*/gi, ""),
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

export const sendTurnNotification = (playerId, gameId) => {
  notify(playerId, {
    title: `Your turn in game ${gameId}!`,
    gameId,
  });
};

export const sendDisapproveNotification = (playerId, gameId) => {
  notify(playerId, {
    title: `Your turn in game ${gameId} is not approved`,
    message: `Please undo your turn and make another one`,
    gameId,
  });
};
