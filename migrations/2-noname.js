'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * createTable "games", deps: [rooms]
 * addColumn "gameId" to table "users"
 *
 **/

var info = {
    "revision": 2,
    "name": "noname",
    "created": "2020-02-23T21:19:42.408Z",
    "comment": ""
};

var migrationCommands = function(transaction) {
    return [{
            fn: "createTable",
            params: [
                "games",
                {
                    "id": {
                        "type": Sequelize.INTEGER,
                        "field": "id",
                        "autoIncrement": true,
                        "primaryKey": true,
                        "allowNull": false
                    },
                    "letters": {
                        "type": Sequelize.JSON,
                        "field": "letters"
                    },
                    "phase": {
                        "type": Sequelize.ENUM('turn', 'validation', 'finished'),
                        "field": "phase",
                        "defaultValue": "turn"
                    },
                    "turnOrder": {
                        "type": Sequelize.JSON,
                        "field": "turnOrder"
                    },
                    "turn": {
                        "type": Sequelize.INTEGER,
                        "field": "turn"
                    },
                    "passedCount": {
                        "type": Sequelize.INTEGER,
                        "field": "passedCount",
                        "defaultValue": 0
                    },
                    "score": {
                        "type": Sequelize.JSON,
                        "field": "score"
                    },
                    "board": {
                        "type": Sequelize.JSON,
                        "field": "board"
                    },
                    "confirmCount": {
                        "type": Sequelize.INTEGER,
                        "field": "confirmCount"
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
                    "RoomId": {
                        "type": Sequelize.INTEGER,
                        "field": "RoomId",
                        "onUpdate": "CASCADE",
                        "onDelete": "SET NULL",
                        "references": {
                            "model": "rooms",
                            "key": "id"
                        },
                        "allowNull": true
                    }
                },
                {
                    "transaction": transaction
                }
            ]
        },
        {
            fn: "addColumn",
            params: [
                "users",
                "gameId",
                {
                    "type": Sequelize.INTEGER,
                    "field": "gameId",
                    "onUpdate": "CASCADE",
                    "onDelete": "SET NULL",
                    "references": {
                        "model": "games",
                        "key": "id"
                    },
                    "allowNull": true,
                    "name": "gameId"
                },
                {
                    transaction: transaction
                }
            ]
        }
    ];
};
var rollbackCommands = function(transaction) {
    return [{
            fn: "removeColumn",
            params: [
                "users",
                "gameId",
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "dropTable",
            params: ["games", {
                transaction: transaction
            }]
        }
    ];
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
