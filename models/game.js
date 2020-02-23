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
    turnOrder: DataTypes.JSON,
    turn: DataTypes.INTEGER,
    passedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    score: DataTypes.JSON,
    board: DataTypes.JSON,
    confirmCount: DataTypes.INTEGER
  });
  Game.associate = function(models) {
    Game.hasMany(models.user, {
      foreignKey: {
        name: "gameId"
      }
    });
    Game.belongsTo(models.Room);
  };
  return Game;
};
