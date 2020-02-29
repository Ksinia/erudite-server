const { Router } = require("express");
const { room, user, game } = require("../models");
const authMiddleware = require("../auth/middleware");

function factory(stream) {
  const router = new Router();

  const switchRooms = async (currentUser, newRoomId, next) => {
    try {
      const oldRoom = await room.findByPk(currentUser.roomId, {
        include: [
          {
            model: user,
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          },
          { model: game }
        ]
      });
      oldRoom &&
        (await oldRoom.update({
          phase: "waiting"
        }));
      const oldRoomId = oldRoom ? oldRoom.id : null;

      await currentUser.update({
        roomId: newRoomId
      });
      const newRoom = await room.findByPk(newRoomId, {
        include: [
          {
            model: user,
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          },
          { model: game }
        ]
      });
      if (newRoom && newRoom.users.length === newRoom.maxPlayers) {
        await newRoom.update({
          phase: "ready"
        });
      }

      const updatedOldRoom = await room.findByPk(oldRoomId, {
        include: [
          {
            model: user,
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          },
          game
        ]
      });
      const updatedNewRoom = await room.findByPk(newRoomId, {
        include: [
          {
            model: user,
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          },
          game
        ]
      });
      return {
        oldRoom: updatedOldRoom,
        newRoom: updatedNewRoom
      };
    } catch (error) {
      next(error);
    }
  };

  router.post("/room", authMiddleware, async (req, res, next) => {
    const currentUser = req.user;
    try {
      const currentRoom = await room.create(req.body);
      const newRoomId = currentRoom.id;
      const updatedRooms = await switchRooms(currentUser, newRoomId, next);
      const action = {
        type: "NEW_ROOM",
        payload: updatedRooms
      };
      const string = JSON.stringify(action);
      stream.send(string);
      res.send(updatedRooms);
    } catch (error) {
      next(error);
    }
  });

  router.put("/join", authMiddleware, async (req, res, next) => {
    const currentUser = req.user;
    const newRoomId = req.body.newRoomId;
    try {
      const updatedRooms = await switchRooms(currentUser, newRoomId, next);
      const action = {
        type: "UPDATED_ROOMS",
        payload: updatedRooms
      };
      const string = JSON.stringify(action);
      stream.send(string);
      res.send(string);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
module.exports = factory;
