const { Message, User, Game } = require("./models");
const { toData } = require("./auth/jwt");
const {
  addPlayerClient,
  removePlayerClient,
  getClientsByPlayerId,
} = require("./socketClients");
const {
  countAllMessagesInLobby,
  getAllMessagesInGame,
} = require("./services/chat");
const registerVisit = require("./services/visit");
const { fetchGames } = require("./services/lobby");
const {
  NEW_MESSAGE,
  MESSAGES_COUNT,
  ALL_MESSAGES,
  ALL_GAMES,
  GAME_UPDATED,
  LOGIN_OR_SIGNUP_ERROR,
} = require("./constants/outgoingMessageTypes");
const fetchGame = require("./services/fetchGame");
const { notify } = require("./services/notifications");

const receiveSaveAndSendNewMessage = async (
  webSocketsServer,
  socket,
  payload
) => {
  // store the message in DB
  try {
    Message.create({
      text: payload,
      name: socket.user.name,
      GameId: socket.gameId,
      UserId: socket.user.id,
    });
    webSocketsServer.to(socket.gameId).emit("message", {
      type: NEW_MESSAGE,
      payload: {
        userId: socket.playerId,
        text: payload,
        name: socket.user.name,
      },
    });
  } catch (error) {
    console.log("problem storing and sending chat message:", error);
  }
  try {
    const usersOfThisGame = await User.findAll({
      include: {
        model: Game,
        as: "games",
        where: { id: socket.gameId },
        attributes: [],
      },
      attributes: ["id", "name", "email"],
    });
    await Promise.all(
      usersOfThisGame
        .filter((user) => user.id !== socket.user.id)
        .map(async (user) => {
          notify(user.id, {
            title: `New chat message`,
            message: `${socket.user.name} in game ${socket.gameId}: ${payload}`,
            gameId: socket.gameId,
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

const addUserToSocket = async (webSocketsServer, socket, jwt) => {
  let user = undefined;
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
    socket.playerId = user.id;
    socket.user = user;
    addPlayerClient(socket);
    try {
      const count = await countAllMessagesInLobby(user.id);
      socket.emit("message", { type: MESSAGES_COUNT, payload: count });
      // if user was on a game page but not logged in and then he logs in we need to send him more full game object
      if (socket.gameId) {
        const game = await fetchGame(socket.gameId, user.id);
        socket.emit("message", {
          type: GAME_UPDATED,
          payload: { gameId: socket.gameId, game },
        });
        const allMessages = await getAllMessagesInGame(socket.gameId, user.id);
        if (allMessages.length > 0) {
          socket.emit("message", { type: ALL_MESSAGES, payload: allMessages });
        }
        await registerVisit(socket.gameId, user.id);
      }
    } catch (error) {
      console.log(error);
    }
  }
};
const removeUserFromSocket = (webSocketsServer, socket) => {
  removePlayerClient(socket);
};
const addGameToSocket = async (webSocketsServer, socket, gameId) => {
  socket.leave("lobby");
  socket.join(gameId);
  socket.gameId = gameId;
  try {
    const allMessages = await getAllMessagesInGame(
      gameId,
      // socket.user.id || -1
      socket.playerId
    );
    if (allMessages.length > 0) {
      socket.emit("message", { type: ALL_MESSAGES, payload: allMessages });
    }

    if (socket.user) {
      await registerVisit(gameId, socket.user.id);
    }
  } catch (error) {
    console.log(error);
  }
};
const removeGameFromSocket = async (webSocketsServer, socket, gameId) => {
  if (!gameId) {
    console.log(`gameId is ${gameId} for socket.playerId ${socket.playerId}`);
  } else {
    try {
      await registerVisit(socket.gameId, socket.playerId);
      socket.leave(gameId);
      delete socket.gameId;
    } catch (error) {
      console.log(error);
    }
  }
};
const enterLobby = async (webSocketsServer, socket) => {
  socket.join("lobby");
  delete socket.gameId;
  try {
    const count = await countAllMessagesInLobby(socket.playerId);
    socket.emit("message", { type: MESSAGES_COUNT, payload: count });
    const games = await fetchGames();
    socket.emit("message", { type: ALL_GAMES, payload: games });
  } catch (error) {
    console.log(error);
  }
};
module.exports = {
  SEND_CHAT_MESSAGE: receiveSaveAndSendNewMessage,
  ADD_USER_TO_SOCKET: addUserToSocket,
  REMOVE_USER_FROM_SOCKET: removeUserFromSocket,
  ADD_GAME_TO_SOCKET: addGameToSocket,
  REMOVE_GAME_FROM_SOCKET: removeGameFromSocket,
  ENTER_LOBBY: enterLobby,
};
