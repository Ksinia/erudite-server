"use strict";

import User from "./user.js";
import { DataTypes, Model } from "sequelize";
import { sequelize } from "./index.js";

class BlockedUser extends Model {
  declare id: number;
  declare UserId: number;
  declare BlockedUserId: number;
}

BlockedUser.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: "Blocked_Users",
  }
);

BlockedUser.belongsTo(User, { as: "user", foreignKey: "UserId" });
BlockedUser.belongsTo(User, { as: "blockedUser", foreignKey: "BlockedUserId" });

export default BlockedUser;
