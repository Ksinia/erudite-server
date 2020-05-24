'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * createTable "SequelizeMeta", deps: []
 * createTable "rooms", deps: []
 * createTable "games", deps: [rooms]
 * createTable "users", deps: [rooms]
 * createTable "game_user", deps: [games, users]
 *
 **/

var info = {
    "revision": 1,
    "name": "noname",
    "created": "2020-02-28T23:48:38.866Z",
    "comment": ""
};

var migrationCommands = function(transaction) {
    return [{
            fn: "createTable",
            params: [
                "SequelizeMeta",
                {
                    "name": {
                        "type": Sequelize.STRING,
                        "field": "name",
                        "autoIncrement": false,
                        "primaryKey": true,
                        "unique": true,
                        "allowNull": false
                    }
                },
                {
                    "charset": "utf8",
                    "transaction": transaction
                }
            ]
        },
        {
            fn: "createTable",
            params: [
                "rooms",
                {
                    "id": {
                        "type": Sequelize.INTEGER,
                        "field": "id",
                        "autoIncrement": true,
                        "primaryKey": true,
                        "allowNull": false
                    },
                    "name": {
                        "type": Sequelize.STRING,
                        "field": "name",
                        "allowNull": false
                    },
                    "maxPlayers": {
                        "type": Sequelize.INTEGER,
                        "field": "maxPlayers"
                    },
                    "phase": {
                        "type": Sequelize.ENUM('waiting', 'ready', 'started', 'finished'),
                        "field": "phase",
                        "defaultValue": "waiting"
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
                    }
                },
                {
                    "transaction": transaction
                }
            ]
        },
        {
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
                        "type": Sequelize.ENUM('waiting', 'ready', 'turn', 'validation', 'finished'),
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
                        "field": "board",
                        "defaultValue": Sequelize.Array
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
                    "roomId": {
                        "type": Sequelize.INTEGER,
                        "name": "roomId",
                        "field": "roomId",
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
            fn: "createTable",
            params: [
                "users",
                {
                    "id": {
                        "type": Sequelize.INTEGER,
                        "field": "id",
                        "autoIncrement": true,
                        "primaryKey": true,
                        "allowNull": false
                    },
                    "name": {
                        "type": Sequelize.STRING,
                        "field": "name",
                        "unique": true,
                        "allowNull": false
                    },
                    "password": {
                        "type": Sequelize.STRING,
                        "field": "password",
                        "allowNull": false
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
                    "roomId": {
                        "type": Sequelize.INTEGER,
                        "field": "roomId",
                        "onUpdate": "CASCADE",
                        "onDelete": "SET NULL",
                        "references": {
                            "model": "rooms",
                            "key": "id"
                        },
                        "allowNull": true,
                        "name": "roomId"
                    }
                },
                {
                    "transaction": transaction
                }
            ]
        },
        {
            fn: "createTable",
            params: [
                "game_user",
                {
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
                    "gameId": {
                        "type": Sequelize.INTEGER,
                        "field": "gameId",
                        "onUpdate": "CASCADE",
                        "onDelete": "CASCADE",
                        "references": {
                            "model": "games",
                            "key": "id"
                        },
                        "primaryKey": true
                    },
                    "userId": {
                        "type": Sequelize.INTEGER,
                        "field": "userId",
                        "onUpdate": "CASCADE",
                        "onDelete": "CASCADE",
                        "references": {
                            "model": "users",
                            "key": "id"
                        },
                        "primaryKey": true
                    }
                },
                {
                    "transaction": transaction
                }
            ]
        }
    ];
};
var rollbackCommands = function(transaction) {
    return [{
            fn: "dropTable",
            params: ["SequelizeMeta", {
                transaction: transaction
            }]
        },
        {
            fn: "dropTable",
            params: ["games", {
                transaction: transaction
            }]
        },
        {
            fn: "dropTable",
            params: ["rooms", {
                transaction: transaction
            }]
        },
        {
            fn: "dropTable",
            params: ["users", {
                transaction: transaction
            }]
        },
        {
            fn: "dropTable",
            params: ["game_user", {
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
