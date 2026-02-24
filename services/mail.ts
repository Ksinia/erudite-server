import { Resend } from "resend";
import Game from "../models/game.js";
import User from "../models/user.js";
import Game_User from "../models/game_user.js";
import Sequelize from "sequelize";
import { notify } from "./notifications.js";
import { clientUrl, fromEmail, resendApiKey } from "../constants/runtime.js";

const resend = new Resend(resendApiKey);

const mail = (to, subject, text) => {
  resend.emails
    .send({ from: fromEmail, to, subject, text })
    .then(({ error }) => {
      if (error) console.error(error);
    })
    .catch((err) => console.error(err));
};

export const sendFinishedGameNotifications = async (gameId) => {
  try {
    const users = await User.findAll({
      include: {
        model: Game,
        as: "games",
        where: { id: gameId },
        attributes: [],
      },
      attributes: ["id", "name", "email"],
    });
    users.forEach((user) => {
      if (user.email && user.emailConfirmed) {
        const subject = `${user.name}, Erudite game ${gameId} is over!`;
        const text = `${user.name}, Erudite game ${gameId} is over! Results: ${clientUrl}/game/${gameId}`;
        mail(user.email, subject, text);
      }
    });
    users.forEach((user) => {
      notify(user.id, {
        title: `${user.name}, Erudite game ${gameId} is over!`,
        gameId,
      });
    });
  } catch (err) {
    console.error(err);
  }
};

export const sendActiveGameNotifications = async () => {
  // TODO: взять людей, у которых есть незаконченные и незаархивированные игры и у которых есть email
  // включить игры в запрос,
  // но только те, где данный пользователь активный сейчас
  // для каждого пользователя отправить письмо со ссылками на игры
  const dayAgo = new Date().setDate(new Date().getDate() - 1);
  try {
    const users = await User.findAll({
      where: {
        email: {
          [Sequelize.Op.ne]: null,
        },
        notifiedAt: {
          [Sequelize.Op.lt]: dayAgo,
        },
      },
      attributes: ["id", "name", "email"],
      include: {
        model: Game,
        as: "games",
        attributes: ["id", "activeUserId", "phase"],
        through: {
          model: Game_User,
          where: {
            visit: {
              [Sequelize.Op.lt]: dayAgo,
            },
          },
        },
        where: {
          archived: false,
          [Sequelize.Op.or]: [
            {
              [Sequelize.Op.and]: [
                {
                  phase: "turn",
                },
              ],
            },
            {
              [Sequelize.Op.and]: [
                {
                  phase: "validation",
                },
              ],
            },
          ],
        },
      },
    });
    await Promise.all(
      users.map(async (user) => {
        const filteredGames = user.games.filter(
          (game) => game.activeUserId === user.id
        );
        if (filteredGames.length > 0) {
          if (user.email && user.emailConfirmed) {
            const to = user.email;
            const subject = `${user.name}, Erudite games are waiting for your action!`;
            const text = `Hi ${
              user.name
            },\n\nthe following Erudite games are waiting for your action:\n\n${filteredGames
              .map((game) => `${clientUrl}/game/${game.id}`)
              .join("\n")}`;
            mail(to, subject, text);
            const now = new Date();
            console.log(`${user.name} was notified at ${now.toLocaleString()}`);
            await user.update({ notifiedAt: now });
          }
        }
      })
    );
  } catch (err) {
    console.error(err);
  }
};

export const sendPasswordResetLink = async (user, link) => {
  const subject = `${user.name}, Erudite password recovery`;
  const text = `Hi ${user.name},\n\nYou can reset your password here: ${link}`;
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: user.email,
    subject,
    text,
  });
  if (error) throw new Error(error.message);
};

export const sendReportEmail = (reporterName, messageText, senderName, gameId) => {
  const subject = `Erudite: message reported by ${reporterName}`;
  const text =
    `Reporter: ${reporterName}\n` +
    `Message sender: ${senderName}\n` +
    `Game: ${gameId}\n\n` +
    `Message text:\n${messageText}`;
  mail("ksenia@ksinia.net", subject, text);
};

export const sendEmailConfirmationLink = (user, link) => {
  const subject = `${user.name}, Erudite email confirmation`;
  const text = `Hi ${user.name},\n\nPlease confirm your email by clicking this link: ${link}`;
  mail(user.email, subject, text);
};
