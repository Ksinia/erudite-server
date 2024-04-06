"use strict";

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./index.js";

class Subscription extends Model {
  declare id: number;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare subscription: object;
  declare userAgent: string;
  declare lastSuccess: Date;
  declare failureCount: number;
}

Subscription.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    subscription: { type: DataTypes.JSONB, unique: true, allowNull: false },
    userAgent: { type: DataTypes.STRING },
    lastSuccess: { type: DataTypes.DATE },
    failureCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    tableName: "Subscriptions",
  }
);

export default Subscription;
