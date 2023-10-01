"use strict";

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./index.js";
import Game_User from "./game_user.js";
import User from "./user.js";
import Message from "./message.js";

class Game extends Model {}

Game.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    language: {
      type: DataTypes.ENUM("ru", "en"),
      defaultValue: "ru",
    },
    letters: {
      type: DataTypes.JSONB,
    },
    phase: {
      type: DataTypes.ENUM(
        "waiting",
        "ready",
        "turn",
        "validation",
        "finished"
      ),
      defaultValue: "turn",
    },
    maxPlayers: {
      type: DataTypes.INTEGER,
    },
    archived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    validated: {
      type: DataTypes.ENUM("unknown", "yes", "no"),
      defaultValue: "unknown",
    },
    turnOrder: DataTypes.JSONB,
    turn: { type: DataTypes.INTEGER, defaultValue: 0 },
    activeUserId: { type: DataTypes.INTEGER },
    passedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    score: DataTypes.JSONB,
    turns: DataTypes.JSONB,
    result: DataTypes.JSONB,
    board: {
      type: DataTypes.JSONB,
      defaultValue: Array(15)
        .fill(null)
        .map(() => Array(15).fill(null)),
    },
    previousBoard: {
      type: DataTypes.JSONB,
      defaultValue: Array(15)
        .fill(null)
        .map(() => Array(15).fill(null)),
    },
    putLetters: { type: DataTypes.JSONB, defaultValue: [] },
    previousLetters: { type: DataTypes.JSONB, defaultValue: [] },
    lettersChanged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    wordsForValidation: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
  },
  {
    sequelize,
    tableName: "Games",
  }
);

Game.belongsToMany(User, {
  as: "users",
  through: Game_User,
});
User.belongsToMany(Game, {
  as: "games",
  through: Game_User,
});

Game.hasMany(Message, {
  as: "messages",
});
Message.belongsTo(Game);

export default Game;
