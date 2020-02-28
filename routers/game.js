const { Router } = require("express");
const authMiddleware = require("../auth/middleware");
const { room, user, game } = require("../models");

const lettersQuantity = [
  "*-3",
  "а-10",
  "б-3",
  "в-5",
  "г-3",
  "д-5",
  "е-9",
  "ж-2",
  "з-2",
  "и-8",
  "й-4",
  "к-6",
  "л-4",
  "м-5",
  "н-8",
  "о-10",
  "п-6",
  "р-6",
  "с-6",
  "т-5",
  "у-3",
  "ф-1",
  "х-2",
  "ц-1",
  "ч-2",
  "ш-1",
  "щ-1",
  "ъ-1",
  "ы-2",
  "ь-2",
  "э-1",
  "ю-1",
  "я-3"
];
const lettersValue = [
  "*-0",
  "а-1",
  "б-3",
  "в-2",
  "г-3",
  "д-2",
  "е-1",
  "ж-5",
  "з-5",
  "и-1",
  "й-2",
  "к-2",
  "л-2",
  "м-2",
  "н-1",
  "о-1",
  "п-2",
  "р-2",
  "с-2",
  "т-2",
  "у-3",
  "ф-10",
  "х-5",
  "ц-10",
  "ч-5",
  "ш-10",
  "щ-10",
  "ъ-10",
  "ы-5",
  "ь-5",
  "э-10",
  "ю-10",
  "я-3"
];

function createLetterArray(qty, value) {
  const qtyArray = qty.split("-");
  const ValueArray = value.split("-");
  return new Array(parseInt(qtyArray[1])).fill({
    char: ValueArray[0],
    value: parseInt(ValueArray[1])
  });
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

const originalLetters = lettersQuantity.reduce((acc, char, index) => {
  return acc.concat(createLetterArray(char, lettersValue[index]));
}, []);

function factory(stream) {
  const router = new Router();

  router.post("/start", authMiddleware, async (req, res, nxt) => {
    roomId = req.body.roomId;
    try {
      const currentRoom = await room.findByPk(roomId, {
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

      //сначала надо будет проверить, что в этой комнате нет незаконченной игры

      const turnOrder = shuffle(currentRoom.users.map(user => user.id));
      const turn = turnOrder[0];

      // give letters to players
      const lettersForGame = shuffle(originalLetters);
      const acc = { pot: lettersForGame.slice(7 * currentRoom.users.length) };
      const letters = currentRoom.users.reduce((acc, user, index) => {
        acc[user.id] = lettersForGame.slice(0 + index * 7, 7 + index * 7);
        return acc;
      }, acc);
      const score = currentRoom.users.reduce((acc, user) => {
        acc[user.id] = 0;
        return acc;
      }, {});
      const currentGame = await game.create({
        turnOrder,
        turn,
        letters,
        roomId,
        score
      });
      await currentGame.setUsers(currentRoom.users);
      await currentRoom.update({ phase: "started" });
      const action = {
        type: "NEW_GAME",
        payload: currentGame
      };
      const string = JSON.stringify(action);
      stream.send(string);
      res.send(currentGame);
    } catch (error) {
      nxt(error);
    }
  });
  return router;
}

module.exports = factory;
