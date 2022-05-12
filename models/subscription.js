"use strict";

module.exports = (sequelize, DataTypes) => {
  const Subscription = sequelize.define("Subscription", {
    subscription: { type: DataTypes.JSONB, unique: true, allowNull: false },
    userAgent: { type: DataTypes.STRING },
    lastSuccess: { type: DataTypes.DATE },
    failureCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  });
  Subscription.associate = function (models) {
    Subscription.belongsToMany(models.User, {
      as: "users",
      through: models.Subscription_User,
    });
  };
  return Subscription;
};
