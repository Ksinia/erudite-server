const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const Sse = require("json-sse");

const signupRouter = require("./routers/user");
const { router: loginRouter } = require("./auth/router");
const roomRouterFactory = require("./routers/room");
const gameRouterFactory = require("./routers/game");
const { room, user, game } = require("./models");

const app = express();
const port = process.env.PORT || 4000;

const bodyParserMiddleware = bodyParser.json();
const corsMiddleware = cors();

app.use(corsMiddleware);
app.use(bodyParserMiddleware);

const stream = new Sse();

const roomRouter = roomRouterFactory(stream);
const gameRouter = gameRouterFactory(stream);

app.use(signupRouter);
app.use(loginRouter);
app.use(roomRouter);
app.use(gameRouter);

app.get("/", (req, res) => {
  stream.send("test");
  res.send("Hello"); //we need res.send to avoid timed out error
});

app.get("/stream", async (req, res, next) => {
  try {
    const rooms = await room.findAll({
      include: [
        {
          model: user,
          attributes: {
            exclude: ["password", "createdAt", "updatedAt", "roomId"]
          }
        },
        {
          model: game
        }
      ]
    });
    const action = {
      type: "ALL_ROOMS",
      payload: rooms
    };
    const string = JSON.stringify(action);
    stream.updateInit(string); //will send initial data to all clients
    stream.init(req, res);
  } catch (error) {
    next(error);
  }
});

app.listen(port, () => console.log(`Listening on port: ${port}`));
