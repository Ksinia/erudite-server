'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * removeColumn "roomId" from table "games"
 * dropTable "rooms"
 * dropTable "room_user"
 *
 **/

var info = {
    "revision": 19,
    "name": "noname",
    "created": "2020-08-15T10:50:52.434Z",
    "comment": ""
};

var migrationCommands = function(transaction) {
    return [{
            fn: "removeColumn",
            params: [
                "games",
                "roomId",
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "dropTable",
            params: ["room_user", {
                transaction: transaction
            }]
        },
        {
            fn: "dropTable",
            params: ["rooms", {
                transaction: transaction
            }]
        }
    ];
};
var rollbackCommands = function(transaction) {
    return [{
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
                    "maxPlayers": {
                        "type": Sequelize.INTEGER,
                        "field": "maxPlayers"
                    },
                    "phase": {
                        "type": Sequelize.ENUM('waiting', 'ready', 'started', 'finished'),
                        "field": "phase",
                        "defaultValue": "waiting"
                    },
                    "language": {
                        "type": Sequelize.ENUM('ru', 'en'),
                        "field": "language",
                        "defaultValue": "ru"
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
                "room_user",
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
                    "roomId": {
                        "type": Sequelize.INTEGER,
                        "field": "roomId",
                        "onUpdate": "CASCADE",
                        "onDelete": "CASCADE",
                        "references": {
                            "model": "rooms",
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
        },
        {
            fn: "addColumn",
            params: [
                "games",
                "roomId",
                {
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
                },
                {
                    transaction: transaction
                }
            ]
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
