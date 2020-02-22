"use strict";
module.exports = (sequelize, DataTypes) => {
  const Room = sequelize.define(
    "Room",
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
        // validate: {
        //   len: {
        //     args: [1, 99],
        //     msg: "Username should not be empty"
        //   }
        // }
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
      },
      turn: DataTypes.INTEGER,
      //   passed: { type: Sequelize.INTEGER, defaultValue: null },
      score: DataTypes.JSON
    },
    { tableName: "rooms" }
  );
  Room.associate = function(models) {
    // models.user.belongsTo(Room),
    Room.hasMany(models.user, {
      foreignKey: {
        name: "roomId"
      }
    });
    // user.hasMany(models.Melody, {
    //   foreignKey: {
    //     name: "userId"
    //   }
    // });
  };
  return Room;
};
