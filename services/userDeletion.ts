import bcrypt from "bcrypt";
import Game from "../models/game.js";
import User from "../models/user.js";
import Message from "../models/message.js";
import { Sequelize } from "../models/index.js";
import { removePushToken } from "./expoPush.js";
import { getClientsByPlayerId } from "../socketClients.js";
import { LOGIN_OR_SIGNUP_ERROR } from "../constants/outgoingMessageTypes.js";

export async function anonymizeUser(userId: number) {
  removePushToken(userId);

  const userGames = await Game.findAll({
    where: {
      phase: { [Sequelize.Op.not]: "finished" },
      archived: false,
    },
    include: [
      {
        model: User,
        as: "users",
        attributes: ["id"],
        where: { id: userId },
        required: true,
      },
    ],
    attributes: ["id"],
  });
  const activeGames = await Game.findAll({
    where: { id: userGames.map((g) => g.id) },
    include: [{ model: User, as: "users", attributes: ["id"] }],
  });
  console.log(
    `anonymizeUser(${userId}): found ${activeGames.length} active games`
  );
  await Promise.all(
    activeGames.map(async (game) => {
      console.log(
        `anonymizeUser(${userId}): game ${game.id} phase=${game.phase} users=${game.users.length}`
      );
      if (game.phase === "waiting" || game.phase === "ready") {
        await game.removeUser(userId);
        const remainingCount = game.users.length - 1;
        if (remainingCount === 0) {
          await game.update({ archived: true });
          console.log(`anonymizeUser(${userId}): archived game ${game.id}`);
        } else if (game.phase === "ready" && remainingCount < game.maxPlayers) {
          await game.update({ phase: "waiting" });
        }
      } else {
        await game.update({ archived: true });
        console.log(`anonymizeUser(${userId}): archived game ${game.id}`);
      }
    })
  );

  await Message.update({ name: "[deleted]" }, { where: { UserId: userId } });

  const randomPassword = bcrypt.hashSync(crypto.randomUUID(), 10);
  await User.update(
    {
      name: `[deleted_${userId}]`,
      email: null,
      password: randomPassword,
      link: null,
      emailConfirmed: false,
      appleId: null,
    },
    { where: { id: userId } }
  );

  const sockets = getClientsByPlayerId(userId);
  for (const socket of sockets) {
    socket.emit("message", {
      type: LOGIN_OR_SIGNUP_ERROR,
      payload: "session_expired",
    });
    socket.disconnect(true);
  }
}
