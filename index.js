const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const { serverPort } = require("./constants/runtime");
const signupRouter = require("./routers/user");
const pushRouter = require("./routers/push");
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

const gameRouter = gameRouterFactory(webSocketsServer);

app.use(signupRouter);
app.use(loginRouter);
app.use(gameRouter);
app.use(pushRouter);

webSocketsServer.on("connection", async (socket) => {
  socket.playerId = -1;
  socket.on("message", (message) => {
    handlers[message.type](webSocketsServer, socket, message.payload);
  });
  socket.on("disconnect", () => {
    removePlayerClient(socket);
  });
});

http.listen(serverPort, () => console.log(`Listening on port: ${serverPort}`));
archivateOldGames();
setInterval(archivateOldGames, 1000 * 60 * 60 * 24);
sendActiveGameNotifications();
setInterval(sendActiveGameNotifications, 1000 * 60 * 60 * 24);
