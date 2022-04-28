const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Sse = require("json-sse");

const { serverPort } = require("./constants/runtime");
const { Sequelize, User, Game } = require("./models");
const signupRouter = require("./routers/user");
const { router: loginRouter } = require("./auth/router");
const gameRouterFactory = require("./routers/game");
const { archivateOldGames } = require("./services/lobby.js");
const { sendActiveGameNotifications } = require("./services/mail");
const { originUrls } = require("./constants/runtime");
const { removePlayerClient } = require("./socketClients");
const handlers = require("./handlers");

const app = express();
const http = require("http").createServer(app);
const webSocketsServer = require("socket.io")(http, {
  path: "/socket",
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
  // TODO: send message about created socket
  // socket.send({ type: "SOCKET_CONNECTED" });
  socket.playerId = -1;
  socket.on("message", (message) => {
    console.log("Handler:", message.type);
    handlers[message.type](webSocketsServer, socket, message.payload);
  });
  socket.on("disconnect", () => {
    removePlayerClient(socket);
  });
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
    // TODO: check why error is visible in browser
  }
});

http.listen(serverPort, () => console.log(`Listening on port: ${serverPort}`));
archivateOldGames();
setInterval(archivateOldGames, 1000 * 60 * 60 * 24);
sendActiveGameNotifications();
setInterval(sendActiveGameNotifications, 1000 * 60 * 60 * 24);
