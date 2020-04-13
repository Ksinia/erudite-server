"use strict";
module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define("room", {
    maxPlayers: {
      type: DataTypes.INTEGER,
    },
    phase: {
      type: DataTypes.ENUM("waiting", "ready", "started", "finished"),
      defaultValue: "waiting",
    },
    language: {
      type: DataTypes.ENUM("ru", "en"),
      defaultValue: "ru",
    },
  });
  Room.associate = function (models) {
    Room.belongsToMany(models.user, {
      through: "room_user",
    }),
      Room.hasMany(models.game, {
        foreignKey: {
          name: "roomId",
        },
      });
  };
  return Room;
};
