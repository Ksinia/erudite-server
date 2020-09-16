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
    email: { type: DataTypes.STRING },
    notifiedAt: {
      type: DataTypes.DATE,
      defaultValue: "2020-02-22 21:27:29.422+00",
    },
  });

  User.associate = function (models) {
    User.belongsToMany(models.Game, {
      as: "games",
      through: models.Game_User,
    });
  };

  return User;
};
