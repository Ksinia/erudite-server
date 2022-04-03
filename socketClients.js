let clientsByPlayerId = {};
let clientsByGameId = { lobby: [] };

const getClientsByPlayerId = (playerId) => {
  return clientsByPlayerId[playerId] || [];
};

const getClientsByGameId = (gameId) => {
  return clientsByGameId[gameId] || [];
};

const addPlayerClient = (socket) => {
  const playerId = socket.playerId;
  if (playerId === -1) {
    return;
  }
  clientsByPlayerId[playerId] = clientsByPlayerId[playerId] || [];
  clientsByPlayerId[playerId].push(socket);
};

const removePlayerClient = (socket) => {
  const playerId = socket.playerId;
  if (playerId === -1) {
    return;
  }
  const clients = clientsByPlayerId[playerId];
  if (clients) {
    const index = clients.indexOf(socket);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  }
};

const addClientToGame = (gameId, socket) => {
  clientsByGameId[gameId] = clientsByGameId[gameId] || [];
  clientsByGameId[gameId].push(socket);
};

const removeClientFromGame = (gameId, socket) => {
  const index = clientsByGameId[gameId].indexOf(socket);
  if (index > -1) {
    clientsByGameId[gameId].splice(index, 1);
  }
};

module.exports = {
  getClientsByPlayerId,
  getClientsByGameId,
  addPlayerClient,
  removePlayerClient,
  addClientToGame,
  removeClientFromGame,
};
