import Game_User from "../models/game_user.js";

export default async (gameId: number, userId: number) => {
  const gameUserEntry = await Game_User.findOne({
    where: { GameId: gameId, UserId: userId },
  });
  if (gameUserEntry) {
    gameUserEntry.visit = new Date();
    await gameUserEntry.save();
  }
};
