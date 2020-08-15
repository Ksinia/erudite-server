const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Sse = require("json-sse");

const { Sequelize, User, Game, Message } = require("./models");
const signupRouter = require("./routers/user");
const { router: loginRouter } = require("./auth/router");
const gameRouterFactory = require("./routers/game");
const { archivateOldGames } = require("./services/lobby.js");
const { toData } = require("./auth/jwt");

const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  path: "/chat",
});
const port = process.env.PORT || 4000;

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

io.on("connection", async (socket) => {
  const { jwt, gameId } = socket.handshake.query;
  const data = toData(jwt);
  try {
    const user = await User.findByPk(data.userId);
    socket.playerId = user.id || -1;
    const allMessages = await Message.findAll({
      where: { gameId },
      order: [["updatedAt", "DESC"]],
    });
    socket.send({ type: "ALL_MESSAGES", payload: allMessages });

    socket.join(gameId);

    if (user) {
      socket.on("message", (message) => {
        io.to(Object.keys(socket.rooms)[0]).send({
          type: "NEW_MESSAGE",
          payload: { userId: socket.playerId, text: message, name: user.name },
        });
        const newMessage = Message.create({
          text: message,
          name: user.name,
          gameId,
          userId: socket.playerId,
        });
      });

      socket.on("disconnect", () => {});
    }
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

http.listen(port, () => console.log(`Listening on port: ${port}`));
archivateOldGames();
setInterval(archivateOldGames, 1000 * 60 * 60 * 24);
