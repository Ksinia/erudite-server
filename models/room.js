"use strict";
module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define("room", {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    maxPlayers: {
      type: DataTypes.INTEGER
    },
    phase: {
      type: DataTypes.ENUM("waiting", "ready", "started", "finished"),
      defaultValue: "waiting"
    }
  });
  Room.associate = function(models) {
    Room.hasMany(models.user, {
      foreignKey: {
        name: "roomId"
      }
    }),
      Room.hasMany(models.game, {
        foreignKey: {
          name: "roomId"
        }
      });
  };
  return Room;
};
