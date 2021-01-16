"use strict";

module.exports = (sequelize, DataTypes) => {
  const Game = sequelize.define("Game", {
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
    archived: { type: DataTypes.BOOLEAN, defaultValue: false },
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
  });
  Game.associate = function (models) {
    Game.belongsToMany(models.User, {
      as: "users",
      through: models.Game_User,
    });
    Game.hasMany(models.Message, {
      as: "messages",
    });
  };
  return Game;
};
