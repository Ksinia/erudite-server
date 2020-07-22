'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * createTable "Messages", deps: [users, games]
 *
 **/

var info = {
    "revision": 17,
    "name": "noname",
    "created": "2020-07-22T12:41:39.740Z",
    "comment": ""
};

var migrationCommands = function(transaction) {
    return [{
        fn: "createTable",
        params: [
            "Messages",
            {
                "id": {
                    "type": Sequelize.INTEGER,
                    "field": "id",
                    "autoIncrement": true,
                    "primaryKey": true,
                    "allowNull": false
                },
                "text": {
                    "type": Sequelize.STRING,
                    "field": "text"
                },
                "createdAt": {
                    "type": Sequelize.DATE,
                    "field": "createdAt",
                    "allowNull": false
                },
                "updatedAt": {
                    "type": Sequelize.DATE,
                    "field": "updatedAt",
                    "allowNull": false
                },
                "userId": {
                    "type": Sequelize.INTEGER,
                    "field": "userId",
                    "onUpdate": "CASCADE",
                    "onDelete": "SET NULL",
                    "references": {
                        "model": "users",
                        "key": "id"
                    },
                    "allowNull": true
                },
                "gameId": {
                    "type": Sequelize.INTEGER,
                    "field": "gameId",
                    "onUpdate": "CASCADE",
                    "onDelete": "SET NULL",
                    "references": {
                        "model": "games",
                        "key": "id"
                    },
                    "allowNull": true
                }
            },
            {
                "transaction": transaction
            }
        ]
    }];
};
var rollbackCommands = function(transaction) {
    return [{
        fn: "dropTable",
        params: ["Messages", {
            transaction: transaction
        }]
    }];
};

module.exports = {
    pos: 0,
    useTransaction: true,
    execute: function(queryInterface, Sequelize, _commands)
    {
        var index = this.pos;
        function run(transaction) {
            const commands = _commands(transaction);
            return new Promise(function(resolve, reject) {
                function next() {
                    if (index < commands.length)
                    {
                        let command = commands[index];
                        console.log("[#"+index+"] execute: " + command.fn);
                        index++;
                        queryInterface[command.fn].apply(queryInterface, command.params).then(next, reject);
                    }
                    else
                        resolve();
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
    up: function(queryInterface, Sequelize)
    {
        return this.execute(queryInterface, Sequelize, migrationCommands);
    },
    down: function(queryInterface, Sequelize)
    {
        return this.execute(queryInterface, Sequelize, rollbackCommands);
    },
    info: info
};
