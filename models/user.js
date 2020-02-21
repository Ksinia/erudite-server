"use strict";
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
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
    },
    { tableName: "users" }
  );
  // User.associate = function(models) {
  //   User.hasMany(models.Dictation, {
  //     foreignKey: {
  //       name: "userId"
  //     }
  //   });
  //   User.hasMany(models.Melody, {
  //     foreignKey: {
  //       name: "userId"
  //     }
  //   });
  // };
  return User;
};
