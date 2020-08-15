const { User, Game } = require("../models");
/**
 * Returns game object from db
 */
module.exports = async (gameId) => {
  return Game.findByPk(gameId, {
    include: [
      {
        model: User,
        as: "users",
        attributes: ["id", "name"],
      },
    ],
  });
};
