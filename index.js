const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Sse = require("json-sse");

const { serverPort } = require("./constants/runtime");
const { Sequelize, User, Game, Message, Game_User } = require("./models");
const signupRouter = require("./routers/user");
const { router: loginRouter } = require("./auth/router");
const gameRouterFactory = require("./routers/game");
const { archivateOldGames } = require("./services/lobby.js");
const { toData } = require("./auth/jwt");
const { sendActiveGameNotifications } = require("./services/mail");
const { originUrls } = require("./constants/runtime");

const app = express();
const http = require("http").createServer(app);
const webSocketsServer = require("socket.io")(http, {
  path: "/chat",
  origins: originUrls,
});
const lobbySocketServer = require("socket.io")(http, {
  path: "/lobby",
  origins: originUrls,
});

const bodyParserMiddleware = bodyParser.json();
const corsMiddleware = cors();

app.use(corsMiddleware);
app.use(bodyParserMiddleware);

const lobbyStream = new Sse();
const gameStream = new Sse();

const gameRouter = gameRouterFactory(gameStream, lobbyStream);

app.use(signupRouter);
app.use(loginRouter);
app.use(gameRouter);

app.get("/", (_, res) => {
  lobbyStream.send("test");
  res.send("Hello"); //we need res.send to avoid timed out error
});

webSocketsServer.on("connection", async (socket) => {
  const { jwt, gameId } = socket.handshake.query;
  const data = toData(jwt);
  try {
    const user = await User.findByPk(data.userId, {
      attributes: ["id", "name"],
    });
    socket.playerId = user.id || -1;
    const allMessages = await Message.findAll({
      where: { GameId: gameId },
      order: [["updatedAt", "DESC"]],
    });
    socket.send({ type: "ALL_MESSAGES", payload: allMessages });

    socket.join(gameId);

    if (user) {
      socket.on("message", (message) => {
        webSocketsServer.to(Object.keys(socket.rooms)[0]).send({
          type: "NEW_MESSAGE",
          payload: { userId: socket.playerId, text: message, name: user.name },
        });
        // store the message in DB
        Message.create({
          text: message,
          name: user.name,
          GameId: gameId,
          UserId: socket.playerId,
        });
      });
      const gameUserEntry = await Game_User.findOne({
        where: { GameId: gameId, UserId: user.id },
      });
      if (gameUserEntry) {
        gameUserEntry.visit = new Date();
        gameUserEntry.save();
      }

      socket.on("disconnect", () => {});
    }
  } catch (error) {
    console.log(error);
  }
});
lobbySocketServer.on("connection", async (socket) => {
  const { jwt } = socket.handshake.query;
  const data = toData(jwt);
  try {
    const user = await User.findByPk(data.userId, {
      benchmark: true,
      logging: console.log,
      attributes: ["id"],
    });

    socket.playerId = user.id || -1;

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
          where: { id: user.id },
        },
        {
          model: Message,
          as: "messages",
          attributes: [],
          where: {
            createdAt: {
              [Sequelize.Op.gt]: Sequelize.col("users->Game_User.visit"),
            },
            UserId: { [Sequelize.Op.not]: user.id },
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

    const count = messagesCountList.reduce((acc, el) => {
      acc[el.dataValues.id] = parseInt(el.dataValues.messagesCount);
      return acc;
    }, {});
    socket.send({ type: "MESSAGES_COUNT", payload: count });
  } catch (error) {
    console.log(error);
  }
});

app.get("/stream", async (req, res, next) => {
  try {
    let games = await Game.findAll({
      attributes: [
        "id",
        "phase",
        "turnOrder",
        "turn",
        "validated",
        "language",
        "maxPlayers",
        "activeUserId",
      ],
      where: {
        phase: {
          [Sequelize.Op.not]: "finished",
        },
        archived: false,
      },
      include: [
        {
          model: User,
          as: "users",
          attributes: ["id", "name"],
        },
      ],
    });

    const action = {
      type: "ALL_GAMES",
      payload: games,
    };
    const string = JSON.stringify(action);
    lobbyStream.updateInit(string); //will send initial data to all clients
    lobbyStream.init(req, res);
  } catch (error) {
    next(error);
  }
});

http.listen(serverPort, () => console.log(`Listening on port: ${serverPort}`));
archivateOldGames();
setInterval(archivateOldGames, 1000 * 60 * 60 * 24);
sendActiveGameNotifications();
setInterval(sendActiveGameNotifications, 1000 * 60 * 60 * 24);
