'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * createTable "Subscriptions", deps: []
 * createTable "Subscription_User", deps: [Subscriptions, Users]
 *
 **/

var info = {
    "revision": 27,
    "name": "noname",
    "created": "2022-05-12T21:02:26.687Z",
    "comment": ""
};

var migrationCommands = function(transaction) {
    return [{
            fn: "createTable",
            params: [
                "Subscriptions",
                {
                    "id": {
                        "type": Sequelize.INTEGER,
                        "field": "id",
                        "autoIncrement": true,
                        "primaryKey": true,
                        "allowNull": false
                    },
                    "subscription": {
                        "type": Sequelize.JSONB,
                        "field": "subscription",
                        "allowNull": false,
                        "unique": true
                    },
                    "userAgent": {
                        "type": Sequelize.STRING,
                        "field": "userAgent"
                    },
                    "lastSuccess": {
                        "type": Sequelize.DATE,
                        "field": "lastSuccess"
                    },
                    "failureCount": {
                        "type": Sequelize.INTEGER,
                        "field": "failureCount",
                        "defaultValue": 0
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
                "Subscription_User",
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
                    "SubscriptionId": {
                        "type": Sequelize.INTEGER,
                        "field": "SubscriptionId",
                        "onUpdate": "CASCADE",
                        "onDelete": "CASCADE",
                        "references": {
                            "model": "Subscriptions",
                            "key": "id"
                        },
                        "primaryKey": true
                    },
                    "UserId": {
                        "type": Sequelize.INTEGER,
                        "field": "UserId",
                        "onUpdate": "CASCADE",
                        "onDelete": "CASCADE",
                        "references": {
                            "model": "Users",
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
            params: ["Subscriptions", {
                transaction: transaction
            }]
        },
        {
            fn: "dropTable",
            params: ["Subscription_User", {
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
