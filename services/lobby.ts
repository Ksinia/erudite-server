import Game from "../models/game.js";
import User from "../models/user.js";
import Sequelize from "sequelize";
import { UPDATED_GAME_IN_LOBBY } from "../constants/outgoingMessageTypes.js";

function getFirstTurnWord(
  turns: { words: { [key: string]: number }[] }[] | undefined
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

/**
 * Extracts properties needed for lobby from the game object
 * @returns action for updated game in lobby
 */
export const getUpdatedGameForLobby = (game) => {
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
    centerWord: getFirstTurnWord(game.turns),
  };
  return {
    type: UPDATED_GAME_IN_LOBBY,
    payload: lobbyGame,
  };
};

export const fetchGames = async () => {
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
  return games.map((game) => {
    const json = game.toJSON();
    const { turns, ...rest } = json;
    return { ...rest, centerWord: getFirstTurnWord(turns) };
  });
};
