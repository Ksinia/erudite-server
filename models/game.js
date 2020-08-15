"use strict";

module.exports = (sequelize, DataTypes) => {
  const Game = sequelize.define("Game", {
    language: {
      type: DataTypes.ENUM("ru", "en"),
      defaultValue: "ru",
    },
    letters: {
      type: DataTypes.JSON,
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
    turnOrder: DataTypes.JSON,
    turn: { type: DataTypes.INTEGER, defaultValue: 0 },
    passedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    score: DataTypes.JSON,
    turns: DataTypes.JSON,
    result: DataTypes.JSON,
    board: {
      type: DataTypes.JSON,
      defaultValue: Array(15)
        .fill(null)
        .map(() => Array(15).fill(null)),
    },
    previousBoard: {
      type: DataTypes.JSON,
      defaultValue: Array(15)
        .fill(null)
        .map(() => Array(15).fill(null)),
    },
    putLetters: { type: DataTypes.JSON, defaultValue: [] },
    previousLetters: { type: DataTypes.JSON, defaultValue: [] },
    lettersChanged: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    wordsForValidation: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
  });
  Game.associate = function (models) {
    Game.belongsToMany(models.User, {
      as: "users",
      through: models.Game_User,
    });
  };
  return Game;
};
