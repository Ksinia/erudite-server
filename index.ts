import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { originUrls, serverPort } from "./constants/runtime.js";
import signupRouter from "./routers/user.js";
import pushRouter from "./routers/push.js";
import { router as loginRouter } from "./auth/router.js";
import gameRouterFactory from "./routers/game.js";
import { archiveOldGames } from "./services/lobby.js";
import { sendActiveGameNotifications } from "./services/mail.js";
import { removePlayerClient } from "./socketClients.js";
import handlers from "./handlers.js";

const app = express();
const http = createServer(app);
const webSocketsServer = new Server(http, {
  path: "/socket",
  cors: {
    origin: originUrls,
  },
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
archiveOldGames();
setInterval(archiveOldGames, 1000 * 60 * 60 * 24);
sendActiveGameNotifications();
setInterval(sendActiveGameNotifications, 1000 * 60 * 60 * 24);
