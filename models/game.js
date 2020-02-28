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
    board: {
      type: DataTypes.JSON,
      defaultValue: new Array(15).fill(new Array(15).fill(this.cell))
    },
    confirmCount: DataTypes.INTEGER
  });
  Game.associate = function(models) {
    Game.belongsToMany(models.user, {
      through: "game_user"
    });
    Game.belongsTo(models.room);
  };
  return Game;
};
