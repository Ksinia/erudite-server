import Game from "../models/game.js";
import User from "../models/user.js";

/**
 * Returns game object from db
 */
export default async (gameId: number) => {
  return Game.findByPk(gameId, {
    include: [
      {
        model: User,
        as: "users",
        attributes: ["id", "name"],
      },
    ],
  });
  // TODO: send game without letters and letters via socket
  // return Game.findByPk(gameId, {
  //   attributes: [
  //     "id",
  //     "language",
  //     "phase",
  //     "maxPlayers",
  //     "archived",
  //     "validated",
  //     "turnOrder",
  //     "turn",
  //     "activeUserId",
  //     "score",
  //     "turns",
  //     "result",
  //     "board",
  //     "previousBoard",
  //     "putLetters",
  //     "previousLetters",
  //     "lettersChanged",
  //     "wordsForValidation",
  //   ],
  //   include: [
  //     {
  //       model: User,
  //       as: "users",
  //       attributes: ["id", "name"],
  //     },
  //   ],
  // });
};
