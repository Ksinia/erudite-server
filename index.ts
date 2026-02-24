import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server, Socket } from "socket.io";

import { originUrls, serverPort } from "./constants/runtime.js";
import signupRouter from "./routers/user.js";
import pushRouter from "./routers/push.js";
import { router as loginRouter } from "./auth/router.js";
import gameRouterFactory from "./routers/game.js";
import { archiveOldGames } from "./services/lobby.js";
import { sendActiveGameNotifications } from "./services/mail.js";
import { removePlayerClient } from "./socketClients.js";
import handlers from "./handlers.js";
import { LOGIN_OR_SIGNUP_ERROR } from "./constants/outgoingMessageTypes.js";
import User from "./models/user";

interface ServerToClientEvents {
  message: (message: { type: string; payload }) => void;
}

interface ClientToServerEvents {
  message: (message: { type: string; payload }) => void;
  disconnect: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface InterServerEvents {}

interface SocketData {
  playerId: number;
  gameId: number;
  user: User;
  blockedUserIds: Set<number>;
}

export type MyServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type MySocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const app = express();
const http = createServer(app);
const webSocketsServer: MyServer = new Server(http, {
  path: "/socket",
  cors: {
    origin: originUrls,
  },
});

const bodyParserMiddleware = bodyParser.json();
const corsMiddleware = cors({ origin: originUrls });

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "too_many_requests" },
});

app.use(corsMiddleware);
app.use(bodyParserMiddleware);

app.post("/login", authRateLimit);
app.post("/signup", authRateLimit);
app.post("/generate-link", authRateLimit);

const gameRouter = gameRouterFactory(webSocketsServer);

app.use(signupRouter);
app.use(loginRouter);
app.use(gameRouter);
app.use(pushRouter);

const HANDLERS_REQUIRING_AUTH = new Set(["SEND_CHAT_MESSAGE"]);

webSocketsServer.on("connection", async (socket) => {
  socket.data.playerId = -1;
  socket.on("message", (message, ack) => {
    if (!(message.type in handlers)) {
      console.log("unhandled:", message);
      return;
    }
    console.log("handled:", message);
    if (HANDLERS_REQUIRING_AUTH.has(message.type) && !socket.data.user) {
      console.log("rejected unauthenticated message:", message.type);
      socket.emit("message", {
        type: LOGIN_OR_SIGNUP_ERROR,
        payload: "session_expired",
      });
      if (ack) ack({ success: false, error: "Not authenticated" });
      return;
    }
    handlers[message.type](webSocketsServer, socket, message.payload, ack);
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
