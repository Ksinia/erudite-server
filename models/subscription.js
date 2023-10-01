"use strict";

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./index.js";

class Subscription extends Model {}

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
