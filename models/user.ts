"use strict";

import { DataTypes, Model } from "sequelize";
import { sequelize } from "./index.js";
import Subscription from "./subscription.js";
import Subscription_User from "./subscription_user.js";

class User extends Model {}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: {
          args: [1, 99],
          msg: "Username should not be empty",
        },
      },
    },
    password: { type: DataTypes.STRING, allowNull: false },
    link: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    notifiedAt: {
      type: DataTypes.DATE,
      defaultValue: "2020-02-22 21:27:29.422+00",
    },
    emailConfirmed: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    tableName: "Users",
  }
);

User.belongsToMany(Subscription, {
  as: "subscriptions",
  through: Subscription_User,
});
Subscription.belongsToMany(User, {
  as: "users",
  through: Subscription_User,
});

export default User;
