"use strict";

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define("Message", {
    text: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING },
  });
  Message.associate = function (models) {
    Message.belongsTo(models.user);
    Message.belongsTo(models.game);
  };
  return Message;
};
