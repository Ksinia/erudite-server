import Game from "../models/game.js";
import User from "../models/user.js";
import updateGame from "./updateGame.js";

/**
 * Adds the current user to the game
 */
export default async (currentUser, gameId) => {
  const game = await Game.findByPk(gameId, {
    include: [
      {
        model: User,
        as: "users",
        attributes: ["id"],
      },
    ],
  });
  await game.addUser(currentUser);
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
