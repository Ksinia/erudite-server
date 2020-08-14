const db = require("../models");

const archivateOldGames = async () => {
  const date = new Date().setDate(new Date().getDate() - 7);
  const games = await db.game.findAll({
    attributes: ["id", "updatedAt"],
    where: {
      phase: {
        [db.Sequelize.Op.not]: "finished",
      },
      archived: "FALSE",
      updatedAt: {
        [db.Sequelize.Op.lt]: date,
      },
    },
  });
  games.map((el) => console.log(el.dataValues));
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
  };
  return {
    type: "UPDATED_GAME_IN_LOBBY",
    payload: lobbyGame,
  };
};

module.exports = { archivateOldGames, getUpdatedGameForLobby };
