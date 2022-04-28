const { Message, Game, Sequelize, User, Game_User } = require("../models");
const getAllMessagesInGame = async (gameId, playerId) => {
  return Message.findAll({
    where: {
      GameId: gameId,
    },
    include: {
      model: Game,
      as: "Game",
      where: {
        [Sequelize.Op.or]: [
          {
            turnOrder: {
              [Sequelize.Op.contains]: playerId,
            },
          },
          {
            phase: ["waiting", "ready"],
          },
        ],
      },
      attributes: [],
    },
    order: [["updatedAt", "DESC"]],
  });
};

const countAllMessagesInLobby = async (userId) => {
  const messagesCountList = await Game.findAll({
    benchmark: true,
    logging: console.log,
    attributes: ["id", [Sequelize.fn("COUNT", "*"), "messagesCount"]],
    include: [
      {
        model: User,
        attributes: [],
        as: "users",
        through: Game_User,
        where: { id: userId },
      },
      {
        model: Message,
        as: "messages",
        attributes: [],
        where: {
          createdAt: {
            [Sequelize.Op.gt]: Sequelize.col("users->Game_User.visit"),
          },
          UserId: { [Sequelize.Op.not]: userId },
        },
      },
    ],
    where: {
      phase: {
        [Sequelize.Op.not]: "finished",
      },
      archived: "FALSE",
    },
    group: [
      "Game.id",
      "users->Game_User.visit",
      "users->Game_User.createdAt",
      "users->Game_User.updatedAt",
      "users->Game_User.GameId",
      "users->Game_User.UserId",
    ],
  });

  return messagesCountList.reduce((acc, el) => {
    acc[el.dataValues.id] = parseInt(el.dataValues.messagesCount);
    return acc;
  }, {});
};
module.exports = {
  getAllMessagesInGame,
  countAllMessagesInLobby,
};
