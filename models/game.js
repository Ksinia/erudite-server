"use strict";

module.exports = (sequelize, DataTypes) => {
  const Game = sequelize.define("game", {
    letters: {
      type: DataTypes.JSON
    },
    phase: {
      type: DataTypes.ENUM("turn", "validation", "finished"),
      defaultValue: "turn"
    },
    validated: {
      type: DataTypes.ENUM("unknown", "yes", "no"),
      defaultValue: "unknown"
    },
    turnOrder: DataTypes.JSON,
    turn: { type: DataTypes.INTEGER, defaultValue: 0 },
    passedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    score: DataTypes.JSON,
    board: {
      type: DataTypes.JSON,
      defaultValue: Array(15)
        .fill(null)
        .map(row => Array(15).fill(null))
    },
    previousBoard: {
      type: DataTypes.JSON,
      defaultValue: Array(15)
        .fill(null)
        .map(row => Array(15).fill(null))
    },
    putLetters: { type: DataTypes.JSON, defaultValue: [] }
  });
  Game.associate = function(models) {
    Game.belongsToMany(models.user, {
      through: "game_user"
    });
    Game.belongsTo(models.room);
  };
  return Game;
};
