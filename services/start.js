const { user: User, game: Game } = require("../models");
const { shuffle } = require("../services/game");
const lettersSets = require("../constants/letterSets");

const getUpdatedGameForLobby = async (gameId) => {
  const game = await Game.findByPk(gameId, {
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
        model: User,
        as: "users",
        attributes: ["id", "name"],
      },
    ],
  });
  return {
    type: "UPDATED_GAME_IN_LOBBY",
    payload: game,
  };
};

const startGame = async (gameId) => {
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
  let acc = { pot: lettersForGame.slice() };
  const letters = game.users.reduce((acc, user) => {
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
  const score = game.users.reduce((acc, user) => {
    acc[user.id] = 0;
    return acc;
  }, {});
  // update database call updates currentGame object
  await game.update({
    turnOrder,
    letters,
    score,
    turns: [],
    result: {},
    phase: "turn",
  });
  return {
    type: "GAME_UPDATED",
    payload: { gameId, game },
  };
};

module.exports = { getUpdatedGameForLobby, startGame };
