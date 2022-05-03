const dotenv = require("dotenv");
const sgMail = require("@sendgrid/mail");
const { User, Game, Game_User, Sequelize } = require("../models");
const { PUSH_NOTIFICATION } = require("../constants/outgoingMessageTypes");
const { getClientsByPlayerId } = require("../socketClients");

dotenv.config();

// using Twilio SendGrid's v3 Node.js Library
// https://github.com/sendgrid/sendgrid-nodejs
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const mail = (to, subject, text) => {
  const msg = {
    to,
    from: "noreply@ksinia.net",
    subject,
    text,
    // html: "<strong>and easy to do anywhere, even with Node.js</strong>",
  };
  sgMail.send(msg).catch((err) => console.error(err));
};

const sendFinishedGameNotifications = async (gameId) => {
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
      if (user.email) {
        const subject = `${user.name}, Erudite game ${gameId} is over!`;
        const text = `${user.name}, Erudite game ${gameId} is over! Results: https://erudit.ksinia.net/game/${gameId}`;
        mail(user.email, subject, text);
      }
    });
    users.forEach((user) => {
      getClientsByPlayerId(user.id).forEach((socket) =>
        socket.send({
          type: PUSH_NOTIFICATION,
          payload: {
            title: `${user.name}, Erudite game ${gameId} is over!`,
            message: `${user.name}, Erudite game ${gameId} is over! Results: https://erudit.ksinia.net/game/${gameId}`,
            gameId,
          },
        })
      );
    });
  } catch (err) {
    console.error(err);
  }
};

const sendActiveGameNotifications = async () => {
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
    users.forEach(async (user) => {
      const filteredGames = user.games.filter(
        (game) => game.activeUserId === user.id
      );
      if (filteredGames.length > 0) {
        const to = user.email;
        const subject = `${user.name}, Erudite games are waiting for your action!`;
        const text = `Hi ${
          user.name
        },\n\nthe following Erudite games are waiting for your action:\n\n${filteredGames
          .map((game) => `https://erudit.ksinia.net/game/${game.id}`)
          .join("\n")}`;
        mail(to, subject, text);
        const now = new Date();
        console.log(`${user.name} was notified at ${now.toLocaleString()}`);
        user.update({ notifiedAt: now });
      }
    });
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  sendFinishedGameNotifications,
  sendActiveGameNotifications,
};
