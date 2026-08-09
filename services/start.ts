import Game from "../models/game.js";
import User from "../models/user.js";
import { shuffle, drawBalancedLetters, BALANCED_USER_ID } from "./game.js";
import lettersSets from "../constants/letterSets/index.js";

export class StartGameError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export default async (gameId: number, currentUserId: number) => {
  const game = await Game.findByPk(gameId, {
    include: [
      {
        model: User,
        as: "users",
        attributes: ["id", "name"],
      },
    ],
  });
  if (!game) {
    throw new StartGameError(404, "game_not_found");
  }
  if (!game.users.some((user) => user.id === currentUserId)) {
    throw new StartGameError(403, "not_a_participant");
  }
  if (game.phase !== "ready") {
    throw new StartGameError(409, "game_not_ready");
  }
  const turnOrder = shuffle(game.users.map((user) => user.id));
  const set = lettersSets[game.language].letters;
  // give letters to players
  const lettersForGame = shuffle(set);
  const acc = { pot: lettersForGame.slice() };
  const letters = game.users.reduce((acc, user) => {
    if (!acc[user.id]) {
      acc[user.id] = [];
    }
    if (user.id === BALANCED_USER_ID) {
      acc[user.id] = drawBalancedLetters(acc.pot, 7);
    } else {
      while (acc[user.id].length !== 7) {
        acc[user.id].push(
          acc.pot.splice(Math.floor(Math.random() * acc.pot.length), 1)[0]
        );
      }
    }
    return acc;
  }, acc);
  const score = game.users.reduce((acc, user) => {
    acc[user.id] = 0;
    return acc;
  }, {});
  const properties = {
    turnOrder,
    letters,
    score,
    turns: [],
    result: {},
    phase: "turn",
    activeUserId: turnOrder[0],
    archived: false,
  };
  // atomic guard: only the request that flips the game out of "ready"
  // wins, so two concurrent starts can't both reshuffle and wipe it
  const [affected] = await Game.update(properties, {
    where: { id: gameId, phase: "ready" },
  });
  if (affected === 0) {
    throw new StartGameError(409, "game_not_ready");
  }
  // keep the in-memory instance in sync for the caller
  game.set(properties);
  return game;
};
