import type { InferAttributes } from "sequelize";
import type Game from "../models/game.js";

type GameJson = InferAttributes<Game>;
type GameLetters = GameJson["letters"];

/**
 * Returns a plain game object safe to send to the given user:
 * the recipient keeps their own hand, the pot is masked to an array
 * of the same length (the client only uses its size), and other
 * players' letters are removed. Anonymous recipients get no hand.
 */
export const sanitizeGame = (game: Game, userId: number | null) => {
  const json = game.toJSON() as GameJson;
  const sourceLetters = json.letters;
  const letters: GameLetters = {
    pot: Array(sourceLetters?.pot?.length ?? 0).fill(""),
  };
  if (userId !== null && sourceLetters?.[userId]) {
    letters[userId] = sourceLetters[userId];
  }
  const isTurnUser = userId !== null && json.turnOrder?.[json.turn] === userId;
  return {
    ...json,
    letters,
    previousLetters: isTurnUser ? json.previousLetters : [],
    putLetters: isTurnUser ? json.putLetters : [],
  };
};

export type SanitizedGame = ReturnType<typeof sanitizeGame>;
