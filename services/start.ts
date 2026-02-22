import Game from "../models/game.js";
import User from "../models/user.js";
import { shuffle, drawBalancedLetters, BALANCED_USER_ID } from "./game.js";
import lettersSets from "../constants/letterSets/index.js";
import updateGame from "./updateGame.js";

export default async (gameId) => {
  const game = await Game.findByPk(gameId, {
    include: [
      {
        model: User,
        as: "users",
        attributes: ["id", "name"],
      },
    ],
  });
  const turnOrder = shuffle(game.users.map((user) => user.id));
  const set = lettersSets[game.language].letters;
  // give letters to players
  const lettersForGame = shuffle(set);
  const acc = { pot: lettersForGame.slice() };
  const letters = game.users.reduce((acc, user) => {
    if (!acc[user.id]) {
      acc[user.id] = [];
    }
    if (user.id === BALANCED_USER_ID) {
      acc[user.id] = drawBalancedLetters(acc.pot, 7);
    } else {
      while (acc[user.id].length !== 7) {
        acc[user.id].push(
          acc.pot.splice(Math.floor(Math.random() * acc.pot.length), 1)[0]
        );
      }
    }
    return acc;
  }, acc);
  const score = game.users.reduce((acc, user) => {
    acc[user.id] = 0;
    return acc;
  }, {});
  // update database call updates currentGame object
  await updateGame(game, {
    turnOrder,
    letters,
    score,
    turns: [],
    result: {},
    phase: "turn",
    activeUserId: turnOrder[0],
  });
  return game;
};
