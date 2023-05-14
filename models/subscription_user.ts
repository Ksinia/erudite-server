"use strict";

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./index.js";

class Subscription_User extends Model {}

Subscription_User.init(
  {
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    freezeTableName: true,
    tableName: "Subscription_User",
  }
);

export default Subscription_User;
