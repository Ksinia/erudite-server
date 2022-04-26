const { Message } = require("./models");
const saveAndSendNewMessage = (webSocketsServer, socket, payload) => {
  // socket can be connected to only 1 room
  const gameId = Object.keys(socket.rooms)[0];
  // store the message in DB
  try {
    Message.create({
      text: payload,
      name: socket.user.name,
      GameId: gameId,
      UserId: socket.user.id,
    });
  } catch (error) {
    console.log("problem storing chat message:", error);
  }
  webSocketsServer.to(gameId).send({
    type: "NEW_MESSAGE",
    payload: {
      userId: socket.playerId,
      text: payload,
      name: socket.user.name,
    },
  });
};

module.exports = { NEW_MESSAGE: saveAndSendNewMessage };
