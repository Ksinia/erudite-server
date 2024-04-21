"use strict";

import { DataTypes, Model, NOW } from "sequelize";
import { sequelize } from "./index.js";

class Game_User extends Model {
  declare createdAt: Date;
  declare updatedAt: Date;
  declare visit: Date;
}

Game_User.init(
  {
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    visit: {
      type: DataTypes.DATE,
      defaultValue: NOW,
      allowNull: false,
    },
  },
  {
    sequelize,
    freezeTableName: true,
    tableName: "Game_User",
  }
);

export default Game_User;
