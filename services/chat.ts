import Game from "../models/game.js";
import Game_User from "../models/game_user.js";
import Message from "../models/message.js";
import User from "../models/user.js";
import { Sequelize } from "../models/index.js";

/**
 * Show messages from waiting and ready games to everyone and from games with other
 * statuses only to participating players
 */
export const getAllMessagesInGame = async (
  gameId: number,
  playerId: number
) => {
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

export const countAllMessagesInLobby = async (userId: number) => {
  const messagesCountList = await Game.findAll({
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
