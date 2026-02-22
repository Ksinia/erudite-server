import Game from "./models/game.js";
import User from "./models/user.js";
import Message from "./models/message.js";
import { toData } from "./auth/jwt.js";
import {
  addPlayerClient,
  getClientsByPlayerId,
  removePlayerClient,
} from "./socketClients.js";
import {
  countAllMessagesInLobby,
  getAllMessagesInGame,
} from "./services/chat.js";
import registerVisit from "./services/visit.js";
import { fetchGames } from "./services/lobby.js";
import {
  ALL_GAMES,
  ALL_MESSAGES,
  GAME_UPDATED,
  LOGIN_OR_SIGNUP_ERROR,
  MESSAGES_COUNT,
  NEW_MESSAGE,
} from "./constants/outgoingMessageTypes.js";
import fetchGame from "./services/fetchGame.js";
import { notify } from "./services/notifications.js";
import { storePushToken } from "./services/expoPush.js";
import { MyServer, MySocket } from "./index";

const BOT_TRIGGER_TEXT = "бот ходи";
const BOT_TRIGGER_USER_ID = 1;

const receiveSaveAndSendNewMessage = async (
  webSocketsServer: MyServer,
  socket: MySocket,
  payload: string,
  ack?: (response: { success: boolean; error?: string }) => void
) => {
  if (
    socket.data.user.id === BOT_TRIGGER_USER_ID &&
    payload.trim().toLowerCase() === BOT_TRIGGER_TEXT
  ) {
    webSocketsServer.to(socket.data.gameId.toString()).emit("message", {
      type: "BOT_TRIGGER",
      payload: { gameId: socket.data.gameId },
    });
    if (ack) ack({ success: true });
    return;
  }
  // store the message in DB
  try {
    await Message.create({
      text: payload,
      name: socket.data.user.name,
      GameId: socket.data.gameId,
      UserId: socket.data.user.id,
    });
    webSocketsServer.to(socket.data.gameId.toString()).emit("message", {
      type: NEW_MESSAGE,
      payload: {
        userId: socket.data.playerId,
        text: payload,
        name: socket.data.user.name,
      },
    });
    if (ack) ack({ success: true });
  } catch (error) {
    console.log("problem storing and sending chat message:", error);
    if (ack) ack({ success: false, error: "Failed to send message" });
    return; // Don't continue with notifications if message failed
  }
  try {
    const usersOfThisGame = await User.findAll({
      include: {
        model: Game,
        as: "games",
        where: { id: socket.data.gameId },
        attributes: [],
      },
      attributes: ["id", "name", "email"],
    });
    await Promise.all(
      usersOfThisGame
        .filter((user) => user.id !== socket.data.user.id)
        .map(async (user) => {
          await notify(user.id, {
            title: `New chat message`,
            message: `${socket.data.user.name} in game ${socket.data.gameId}: ${payload}`,
            gameId: socket.data.gameId,
            type: "chat_message",
          });
          const clients = await Promise.all(getClientsByPlayerId(user.id));
          clients
            .filter((client) => !client.gameId)
            .map(async (client) => {
              client.emit("message", {
                type: MESSAGES_COUNT,
                payload: await countAllMessagesInLobby(user.id),
              });
            });
        })
    );
  } catch (error) {
    console.log("problem getting users of this game:", error);
  }
};

const addUserToSocket = async (
  _: MyServer,
  socket: MySocket,
  payload: string | { jwt: string; pushToken?: string }
) => {
  let user = undefined;

  // Handle both old (string) and new (object) payload formats
  const jwt = typeof payload === "string" ? payload : payload.jwt;
  const pushToken = typeof payload === "object" ? payload.pushToken : undefined;

  console.log("addUserToSocket - JWT:", jwt, "PushToken:", pushToken);

  try {
    const data = toData(jwt);
    user = await User.findByPk(data.userId, {
      attributes: ["id", "name"],
    });
  } catch (error) {
    console.log("problem retrieving user:", error);
    // TODO: remove jwt from local storage on fe
    socket.emit("message", { type: LOGIN_OR_SIGNUP_ERROR, payload: error });
  }
  if (user) {
    socket.data.playerId = user.id;
    socket.data.user = user;
    addPlayerClient(socket);

    // Store Expo push token if provided
    if (pushToken) {
      storePushToken(user.id, pushToken);
    }
    try {
      const count = await countAllMessagesInLobby(user.id);
      socket.emit("message", { type: MESSAGES_COUNT, payload: count });
      // if user was on a game page but not logged in, and then he logs in we need to send him more full game object
      if (socket.data.gameId) {
        const game = await fetchGame(socket.data.gameId);
        socket.emit("message", {
          type: GAME_UPDATED,
          payload: { gameId: socket.data.gameId, game },
        });
        const allMessages = await getAllMessagesInGame(
          socket.data.gameId,
          user.id
        );
        if (allMessages.length > 0) {
          socket.emit("message", { type: ALL_MESSAGES, payload: allMessages });
        }
        await registerVisit(socket.data.gameId, user.id);
      }
    } catch (error) {
      console.log(error);
    }
  }
};
const removeUserFromSocket = (_: MyServer, socket: MySocket) => {
  removePlayerClient(socket);
};
const addGameToSocket = async (
  _: MyServer,
  socket: MySocket,
  gameId: number
) => {
  socket.leave("lobby");
  socket.join(gameId.toString());
  socket.data.gameId = gameId;
  try {
    const allMessages = await getAllMessagesInGame(
      gameId,
      socket.data.playerId
    );
    if (allMessages.length > 0) {
      socket.emit("message", { type: ALL_MESSAGES, payload: allMessages });
    }

    if (socket.data.user) {
      await registerVisit(gameId, socket.data.user.id);
    }
  } catch (error) {
    console.log(error);
  }
};
const removeGameFromSocket = async (
  _: MyServer,
  socket: MySocket,
  gameId: number
) => {
  if (!gameId) {
    console.log(
      `gameId is ${gameId} for socket.data.playerId ${socket.data.playerId}`
    );
  } else {
    try {
      await registerVisit(gameId, socket.data.playerId);
      socket.leave(gameId.toString());
      delete socket.data.gameId;
    } catch (error) {
      console.log(error);
    }
  }
};
const enterLobby = async (_: MyServer, socket: MySocket) => {
  socket.join("lobby");
  delete socket.data.gameId;
  try {
    const count = await countAllMessagesInLobby(socket.data.playerId);
    socket.emit("message", { type: MESSAGES_COUNT, payload: count });
    const games = await fetchGames();
    socket.emit("message", { type: ALL_GAMES, payload: games });
  } catch (error) {
    console.log(error);
  }
};
export default {
  SEND_CHAT_MESSAGE: receiveSaveAndSendNewMessage,
  ADD_USER_TO_SOCKET: addUserToSocket,
  REMOVE_USER_FROM_SOCKET: removeUserFromSocket,
  ADD_GAME_TO_SOCKET: addGameToSocket,
  REMOVE_GAME_FROM_SOCKET: removeGameFromSocket,
  ENTER_LOBBY: enterLobby,
};
