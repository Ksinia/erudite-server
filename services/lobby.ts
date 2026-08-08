import Game from "../models/game.js";
import User from "../models/user.js";
import Sequelize from "sequelize";
import { UPDATED_GAME_IN_LOBBY } from "../constants/outgoingMessageTypes.js";
import { canSeeGame } from "./board.js";

export function getFirstTurnWord(
  turns:
    | { words: { [key: string]: number }[]; changedLetters?: boolean }[]
    | undefined
): string {
  if (!turns || turns.length === 0) return "";
  const firstTurn = turns.find(
    (t) => !t.changedLetters && t.words && t.words.length > 0
  );
  if (!firstTurn) return "";
  const words = firstTurn.words.map((w) =>
    Object.keys(w)[0].replace(/\*/gi, "")
  );
  words.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return words[0] || "";
}

export const archiveOldGames = async () => {
  const date = new Date().setDate(new Date().getDate() - 7);
  const games = await Game.findAll({
    attributes: ["id", "updatedAt"],
    where: {
      phase: {
        [Sequelize.Op.not]: "finished",
      },
      archived: "FALSE",
      updatedAt: {
        [Sequelize.Op.lt]: date,
      },
    },
  });
  if (games.length > 0) {
    await Promise.all(
      games.map(async (el) => await el.update({ archived: true }))
    );
  }
};

export interface LobbyGame {
  id: number;
  phase: string;
  turnOrder: number[] | null;
  turn: number | null;
  validated: string;
  language: string;
  maxPlayers: number;
  users: { id: number; name: string }[];
  activeUserId: number | null;
  boardType?: string;
  centerWord: string;
}

export interface LobbyGameAction {
  type: typeof UPDATED_GAME_IN_LOBBY;
  payload: LobbyGame;
}

/**
 * Extracts properties needed for lobby from the game object
 * @returns action for updated game in lobby
 */
export const getUpdatedGameForLobby = (game): LobbyGameAction => {
  const {
    id,
    phase,
    turnOrder,
    turn,
    validated,
    language,
    maxPlayers,
    users,
    activeUserId,
    boardType,
  } = game;
  const lobbyGame = {
    id,
    phase,
    turnOrder,
    turn,
    validated,
    language,
    maxPlayers,
    users,
    activeUserId,
    boardType,
    centerWord: getFirstTurnWord(game.turns),
  };
  return {
    type: UPDATED_GAME_IN_LOBBY,
    payload: lobbyGame,
  };
};

export const fetchGames = async (userId?: number) => {
  const games = await Game.findAll({
    attributes: [
      "id",
      "phase",
      "turnOrder",
      "turn",
      "validated",
      "language",
      "maxPlayers",
      "activeUserId",
      "boardType",
      "turns",
    ],
    where: {
      phase: {
        [Sequelize.Op.not]: "finished",
      },
      archived: false,
    },
    include: [
      {
        model: User,
        as: "users",
        attributes: ["id", "name"],
      },
    ],
  });
  return games
    .filter((game) => canSeeGame(game, userId))
    .map((game) => {
      const json = game.toJSON();
      const { turns, ...rest } = json;
      return { ...rest, centerWord: getFirstTurnWord(turns) };
    });
};
