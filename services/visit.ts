import Game_User from "../models/game_user.js";

export default async (gameId, userId) => {
  const gameUserEntry = await Game_User.findOne({
    where: { GameId: gameId, UserId: userId },
  });
  if (gameUserEntry) {
    gameUserEntry.visit = new Date();
    await gameUserEntry.save();
  }
};
