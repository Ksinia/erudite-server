"use strict";

var Sequelize = require("sequelize");

/**
 * Actions summary:
 *
 * renameTable "games" to "Games"
 * renameTable "users" to "Users"
 * renameTable "game_user" to "Game_User"
 * renameColumn "gameId" to "GameId" from table "Messages"
 * renameColumn "userId" to "UserId" from table "Messages"
 * renameColumn "gameId" to "GameId" from table "Game_User"
 * renameColumn "userId" to "UserId" from table "Game_User"
 *
 **/

var info = {
  revision: 20,
  name: "noname",
  created: "2020-08-15T11:14:16.223Z",
  comment: "",
};

var migrationCommands = function (transaction) {
  return [
    {
      fn: "renameTable",
      params: [
        "games",
        "Games",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameTable",
      params: [
        "users",
        "Users",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameTable",
      params: [
        "game_user",
        "Game_User",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameColumn",
      params: [
        "Messages",
        "gameId",
        "GameId",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameColumn",
      params: [
        "Messages",
        "userId",
        "UserId",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameColumn",
      params: [
        "Game_User",
        "gameId",
        "GameId",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameColumn",
      params: [
        "Game_User",
        "userId",
        "UserId",
        {
          transaction: transaction,
        },
      ],
    },
  ];
};
var rollbackCommands = function (transaction) {
  return [
    {
      fn: "renameTable",
      params: [
        "Games",
        "games",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameTable",
      params: [
        "Users",
        "users",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameTable",
      params: [
        "Game_User",
        "game_user",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameColumn",
      params: [
        "Messages",
        "GameId",
        "gameId",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameColumn",
      params: [
        "Messages",
        "UserId",
        "userId",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameColumn",
      params: [
        "Game_User",
        "GameId",
        "gameId",
        {
          transaction: transaction,
        },
      ],
    },
    {
      fn: "renameColumn",
      params: [
        "Game_User",
        "UserId",
        "userId",
        {
          transaction: transaction,
        },
      ],
    },
  ];
};

module.exports = {
  pos: 0,
  useTransaction: true,
  execute: function (queryInterface, Sequelize, _commands) {
    var index = this.pos;
    function run(transaction) {
      const commands = _commands(transaction);
      return new Promise(function (resolve, reject) {
        function next() {
          if (index < commands.length) {
            let command = commands[index];
            console.log("[#" + index + "] execute: " + command.fn);
            index++;
            queryInterface[command.fn]
              .apply(queryInterface, command.params)
              .then(next, reject);
          } else resolve();
        }
        next();
      });
    }
    if (this.useTransaction) {
      return queryInterface.sequelize.transaction(run);
    } else {
      return run(null);
    }
  },
  up: function (queryInterface, Sequelize) {
    return this.execute(queryInterface, Sequelize, migrationCommands);
  },
  down: function (queryInterface, Sequelize) {
    return this.execute(queryInterface, Sequelize, rollbackCommands);
  },
  info: info,
};
