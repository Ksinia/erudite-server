const { Game, Sequelize, User } = require("../models");
const { UPDATED_GAME_IN_LOBBY } = require("../constants/outgoingMessageTypes");
const archivateOldGames = async () => {
  const date = new Date().setDate(new Date().getDate() - 7);
  const games = await Game.findAll({
    attributes: ["id", "updatedAt"],
    where: {
      phase: {
        [Sequelize.Op.not]: "finished",
      },
      archived: "FALSE",
      updatedAt: {
        [Sequelize.Op.lt]: date,
      },
    },
  });
  if (games.length > 0) {
    Promise.all(games.map(async (el) => await el.update({ archived: true })));
  }
};

/**
 * Extracts properties needed for lobby from the game object
 * @returns action for updated game in lobby
 */
const getUpdatedGameForLobby = (game) => {
  const {
    id,
    phase,
    turnOrder,
    turn,
    validated,
    language,
    maxPlayers,
    users,
    activeUserId,
  } = game;
  const lobbyGame = {
    id,
    phase,
    turnOrder,
    turn,
    validated,
    language,
    maxPlayers,
    users,
    activeUserId,
  };
  return {
    type: UPDATED_GAME_IN_LOBBY,
    payload: lobbyGame,
  };
};

const fetchGames = () => {
  return Game.findAll({
    attributes: [
      "id",
      "phase",
      "turnOrder",
      "turn",
      "validated",
      "language",
      "maxPlayers",
      "activeUserId",
    ],
    where: {
      phase: {
        [Sequelize.Op.not]: "finished",
      },
      archived: false,
    },
    include: [
      {
        model: User,
        as: "users",
        attributes: ["id", "name"],
      },
    ],
  });
};

module.exports = { archivateOldGames, getUpdatedGameForLobby, fetchGames };
