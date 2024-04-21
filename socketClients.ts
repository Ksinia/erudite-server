import { MySocket } from "./index";

const clientsByPlayerId = {};

export const getClientsByPlayerId = (playerId: number) => {
  return clientsByPlayerId[playerId] || [];
};

export const addPlayerClient = (socket: MySocket) => {
  const playerId = socket.data.playerId;
  if (playerId === -1) {
    return;
  }
  clientsByPlayerId[playerId] = clientsByPlayerId[playerId] || [];
  clientsByPlayerId[playerId].push(socket);
};

export const removePlayerClient = (socket: MySocket) => {
  const playerId = socket.data.playerId;
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
