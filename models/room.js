"use strict";
module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define(
    "Room",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false
        // unique: true
      },
      maxPlayers: {
        type: DataTypes.INTEGER
        // validate: {
        //   min: 1,
        //   max: 10
        // }
      },
      phase: {
        type: DataTypes.ENUM("waiting", "ready", "started", "finished"),
        defaultValue: "waiting"
      }
    },
    { tableName: "rooms" }
  );
  Room.associate = function(models) {
    // models.user.belongsTo(Room),
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
