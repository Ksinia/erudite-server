"use strict";

module.exports = (sequelize) => {
  const Subscription_User = sequelize.define(
    "Subscription_User",
    {},
    {
      freezeTableName: true,
      tableName: "Subscription_User",
    }
  );

  return Subscription_User;
};
