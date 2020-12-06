'use strict';

var Sequelize = require('sequelize');

/**
 * Actions summary:
 *
 * changeColumn "wordsForValidation" on table "Games"
 * changeColumn "previousLetters" on table "Games"
 * changeColumn "putLetters" on table "Games"
 * changeColumn "previousBoard" on table "Games"
 * changeColumn "board" on table "Games"
 * changeColumn "result" on table "Games"
 * changeColumn "turns" on table "Games"
 * changeColumn "score" on table "Games"
 * changeColumn "turnOrder" on table "Games"
 * changeColumn "letters" on table "Games"
 *
 **/

var info = {
    "revision": 25,
    "name": "noname",
    "created": "2020-12-06T15:46:32.820Z",
    "comment": ""
};

var migrationCommands = function(transaction) {
    return [{
            fn: "changeColumn",
            params: [
                "Games",
                "wordsForValidation",
                {
                    "type": Sequelize.JSONB,
                    "field": "wordsForValidation",
                    "defaultValue": Sequelize.Array
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "previousLetters",
                {
                    "type": Sequelize.JSONB,
                    "field": "previousLetters",
                    "defaultValue": Sequelize.Array
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "putLetters",
                {
                    "type": Sequelize.JSONB,
                    "field": "putLetters",
                    "defaultValue": Sequelize.Array
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "previousBoard",
                {
                    "type": Sequelize.JSONB,
                    "field": "previousBoard",
                    "defaultValue": Sequelize.Array
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "board",
                {
                    "type": Sequelize.JSONB,
                    "field": "board",
                    "defaultValue": Sequelize.Array
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "result",
                {
                    "type": Sequelize.JSONB,
                    "field": "result"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "turns",
                {
                    "type": Sequelize.JSONB,
                    "field": "turns"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "score",
                {
                    "type": Sequelize.JSONB,
                    "field": "score"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "turnOrder",
                {
                    "type": Sequelize.JSONB,
                    "field": "turnOrder"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "letters",
                {
                    "type": Sequelize.JSONB,
                    "field": "letters"
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
            fn: "changeColumn",
            params: [
                "Games",
                "wordsForValidation",
                {
                    "type": Sequelize.JSON,
                    "field": "wordsForValidation",
                    "defaultValue": Sequelize.Array
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "previousLetters",
                {
                    "type": Sequelize.JSON,
                    "field": "previousLetters",
                    "defaultValue": Sequelize.Array
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "putLetters",
                {
                    "type": Sequelize.JSON,
                    "field": "putLetters",
                    "defaultValue": Sequelize.Array
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "previousBoard",
                {
                    "type": Sequelize.JSON,
                    "field": "previousBoard",
                    "defaultValue": Sequelize.Array
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "board",
                {
                    "type": Sequelize.JSON,
                    "field": "board",
                    "defaultValue": Sequelize.Array
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "result",
                {
                    "type": Sequelize.JSON,
                    "field": "result"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "turns",
                {
                    "type": Sequelize.JSON,
                    "field": "turns"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "score",
                {
                    "type": Sequelize.JSON,
                    "field": "score"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "turnOrder",
                {
                    "type": Sequelize.JSON,
                    "field": "turnOrder"
                },
                {
                    transaction: transaction
                }
            ]
        },
        {
            fn: "changeColumn",
            params: [
                "Games",
                "letters",
                {
                    "type": Sequelize.JSON,
                    "field": "letters"
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
