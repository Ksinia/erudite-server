let clientsByPlayerId = {};

const getClientsByPlayerId = (playerId) => {
  return clientsByPlayerId[playerId] || [];
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

module.exports = {
  getClientsByPlayerId,
  addPlayerClient,
  removePlayerClient,
};
