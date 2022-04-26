const { Game_User } = require("../models");
module.exports = async (gameId, userId) => {
  const gameUserEntry = await Game_User.findOne({
    where: { GameId: gameId, UserId: userId },
  });
  if (gameUserEntry) {
    gameUserEntry.visit = new Date();
    gameUserEntry.save();
  }
};
