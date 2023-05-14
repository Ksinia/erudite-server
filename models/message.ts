"use strict";

import User from "./user.js";
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./index.js";

class Message extends Model {}

Message.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    text: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "Messages",
  }
);

Message.belongsTo(User);

export default Message;
