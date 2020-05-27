const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Sse = require("json-sse");

const db = require("./models");
const { user, game } = require("./models");
const signupRouter = require("./routers/user");
const { router: loginRouter } = require("./auth/router");
const gameRouterFactory = require("./routers/game");
const { archivateOldGames } = require("./services/lobby.js");

const app = express();
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

app.get("/stream", async (req, res, next) => {
  try {
    let games = await game.findAll({
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
          [db.Sequelize.Op.not]: "finished",
        },
        archived: false,
      },
      include: [
        {
          model: user,
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

app.listen(port, () => console.log(`Listening on port: ${port}`));
archivateOldGames();
setInterval(archivateOldGames, 1000 * 60 * 60 * 24);
