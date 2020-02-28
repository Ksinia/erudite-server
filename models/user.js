"use strict";
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("user", {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        len: {
          args: [1, 99],
          msg: "Username should not be empty"
        }
      }
    },
    password: { type: DataTypes.STRING, allowNull: false }
  });
  User.associate = function(models) {
    User.belongsTo(models.room, {
      foreignKey: {
        name: "roomId"
      }
    });
  };
  User.associate = function(models) {
    User.belongsToMany(models.game, {
      through: "game_user"
    });
  };

  return User;
};
