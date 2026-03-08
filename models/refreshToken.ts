"use strict";

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./index.js";
import User from "./user.js";

class RefreshToken extends Model {
  declare id: number;
  declare tokenHash: string;
  declare UserId: number;
  declare expiresAt: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

RefreshToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    UserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "RefreshTokens",
  }
);

RefreshToken.belongsTo(User, { onDelete: "CASCADE" });

export default RefreshToken;
