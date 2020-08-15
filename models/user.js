"use strict";
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
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
    link: {
      type: DataTypes.STRING,
    },
  });

  User.associate = function (models) {
    User.belongsToMany(models.Game, {
      as: "games",
      through: "Game_User",
    });
  };

  return User;
};
