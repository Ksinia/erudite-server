const { Router } = require("express");
const { Room, user } = require("../models");
const authMiddleware = require("../auth/middleware");

function factory(stream) {
  const router = new Router();

  const switchRooms = async (currentUser, newRoomId, next) => {
    try {
      const oldRoom = await Room.findByPk(currentUser.roomId, {
        include: [
          {
            model: user,
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          }
          //   Card
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
      const newRoom = await Room.findByPk(newRoomId, {
        include: [
          {
            model: user,
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          }
          //   Card
        ]
      });
      if (newRoom && newRoom.users.length === newRoom.maxPlayers) {
        await newRoom.update({
          phase: "ready"
        });
      }

      const updatedOldRoom = await Room.findByPk(oldRoomId, {
        include: [
          {
            model: user,
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          }
          //   Card
        ]
      });
      const updatedNewRoom = await Room.findByPk(newRoomId, {
        include: [
          {
            model: user,
            attributes: {
              exclude: ["password", "createdAt", "updatedAt", "roomId"]
            }
          }
          //   Card
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
      const room = await Room.create(req.body);
      const newRoomId = room.id;
      const updatedRooms = await switchRooms(currentUser, newRoomId, next);
      const action = {
        type: "NEW_ROOM",
        payload: updatedRooms
      };
      const string = JSON.stringify(action);
      console.log(string);
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
