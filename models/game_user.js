"use strict";

const { NOW } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  const Game_User = sequelize.define(
    "Game_User",
    {
      visit: {
        type: DataTypes.DATE,
        defaultValue: NOW,
        allowNull: false,
      },
    },
    {
      freezeTableName: true,
      tableName: "Game_User",
    }
  );

  return Game_User;
};
