import Game from "../models/game.js";
import User from "../models/user.js";

/**
 * Creates a new game with current user as only player if playerIds are undefined
 * or with all users from playersIds, which is set
 * when user clicked 'play again with same players' in finished game
 * returns game object
 */
export default async (currentUser, maxPlayers, playersIds, language) => {
  let users = [];
  let phase = "waiting";
  if (playersIds) {
    users = await User.findAll({
      where: {
        id: playersIds,
      },
    });
    phase = "ready";
  } else {
    users = [currentUser];
  }
  const game = await Game.create({ maxPlayers, language, phase });
  // currently it's impossible to create with existing association
  await game.setUsers(users);
  return Game.findByPk(game.id, {
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
