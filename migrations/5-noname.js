'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * removeColumn "roomId" from table "users"
 * createTable "room_user", deps: [rooms, users]
 *
 **/

var info = {
    "revision": 5,
    "name": "noname",
    "created": "2020-03-18T23:43:11.626Z",
    "comment": ""
};

var migrationCommands = function(transaction) {
    return [{
            fn: "removeColumn",
            params: [
                "users",
                "roomId",
                {
                    transaction: transaction
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
        }
    ];
};
var rollbackCommands = function(transaction) {
    return [{
            fn: "dropTable",
            params: ["room_user", {
                transaction: transaction
            }]
        },
        {
            fn: "addColumn",
            params: [
                "users",
                "roomId",
                {
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
