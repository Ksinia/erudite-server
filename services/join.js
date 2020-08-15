const { User, Game } = require("../models");
const updateGame = require("./updateGame");
/**
 * Adds the current user to the game
 */
module.exports = async (currentUser, gameId) => {
  const game = await Game.findByPk(gameId, {
    include: [
      {
        model: User,
        as: "users",
        attributes: ["id"],
      },
    ],
  });
  await game.addUsers(currentUser);
  // check if game ready to start by reaching maxPlayers
  // after new player joined
  if (game.users.length + 1 === game.maxPlayers) {
    await updateGame(game, {
      phase: "ready",
    });
  }
  return Game.findByPk(gameId, {
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
};
