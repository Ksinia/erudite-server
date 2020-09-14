const dotenv = require("dotenv");
const sgMail = require("@sendgrid/mail");
const { User, Game, Game_User, Sequelize } = require("../models");

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

sendFinishedGameNotifications = async (gameId) => {
  const users = await User.findAll({
    through: {
      model: Game_User,
      where: {
        gameId,
      },
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
};

const sendActiveGameNotifications = async () => {
  // взять людей, у которых есть незаконченные и незаархивированные игры и у которых есть email
  // включить игры в запрос,
  // но только те, где его ход и фаза ход или его ход следующий фаза валидация
  // для каждого пользователя отправить письмо со ссылками на игры
  const date = new Date().setDate(new Date().getDate() - 1);
  try {
    const users = await User.findAll({
      where: {
        email: {
          [Sequelize.Op.ne]: null,
        },
      },
      attributes: ["id", "name", "email"],
      include: {
        model: Game,
        as: "games",
        attributes: ["id", "turn", "turnOrder", "phase"],
        through: {
          model: Game_User,
          where: {
            visit: {
              [Sequelize.Op.lt]: date,
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
                // Sequelize.where(
                //   Sequelize.fn(
                //     "getTurnColumn",
                //     Sequelize.col("turn"),
                //     Sequelize.col("turnOrder")
                //   ),
                //   {
                //     [Sequelize.Op.et]: user.id,
                //   }
                // ),
              ],
            },
            {
              [Sequelize.Op.and]: [
                {
                  phase: "validation",
                },
                // Sequelize.where(
                //   Sequelize.fn(
                //     "getNextTurnColumn",
                //     Sequelize.col("turn"),
                //     Sequelize.col("turnOrder")
                //   ),
                //   {
                //     [Sequelize.Op.et]: user.id,
                //   }
                // ),
              ],
            },
          ],
        },
      },
    });
    users.forEach((user) => {
      const filteredGames = user.games.filter((game) => {
        return (
          (game.phase === "turn" && game.turnOrder[game.turn] == user.id) ||
          (game.phase === "validation" &&
            getNextTurnId(game.turn, game.turnOrder) == user.id)
        );
      });
      if (filteredGames.length > 0) {
        const to = user.email;
        const subject = `${user.name}, Erudite games are waiting for your action!`;
        const text = `Hi ${
          user.name
        },\n\nthe following Erudite games are waiting for your action:\n\n${filteredGames
          .map((game) => `https://erudit.ksinia.net/game/${game.id}`)
          .join("\n")}`;
        mail(to, subject, text);
      }
    });
  } catch (error) {
    console.log(error);
  }
};

const getNextTurnId = (turn, turnOrder) => {
  return turnOrder[(turn + 1) % turnOrder.length];
};

module.exports = {
  sendFinishedGameNotifications,
  sendActiveGameNotifications,
};
