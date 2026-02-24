import Game from "../models/game.js";
import Game_User from "../models/game_user.js";
import Message from "../models/message.js";
import User from "../models/user.js";
import BlockedUser from "../models/blocked_user.js";
import { Sequelize } from "../models/index.js";

const ADMIN_USER_ID = 1;

/**
 * Show messages from waiting and ready games to everyone and from games with other
 * statuses only to participating players. Admin (id=1) can see all game chats.
 * Messages from blocked users are filtered out.
 */
export const getAllMessagesInGame = async (
  gameId: number,
  playerId: number
) => {
  const blockedUserIds = await BlockedUser.findAll({
    where: { UserId: playerId },
    attributes: ["BlockedUserId"],
  }).then((rows) => rows.map((r) => r.BlockedUserId));

  const whereClause: Record<string, unknown> = { GameId: gameId };
  if (blockedUserIds.length > 0) {
    whereClause.UserId = { [Sequelize.Op.notIn]: blockedUserIds };
  }

  let messages: Message[];
  if (playerId === ADMIN_USER_ID) {
    messages = await Message.findAll({
      where: whereClause,
      order: [["updatedAt", "DESC"]],
    });
  } else {
    messages = await Message.findAll({
      where: whereClause,
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
  }

  return messages.map((m) => {
    const json = m.toJSON();
    return {
      id: json.id,
      userId: json.UserId,
      text: json.text,
      name: json.name,
      gameId: json.GameId,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
    };
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
