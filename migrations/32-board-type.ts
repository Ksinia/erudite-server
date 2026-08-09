"use strict";

// CommonJS on purpose, like every other migration here: umzug requires these
// files, and an import statement would make Node treat the file as an ES
// module, where module.exports does not exist and the app fails to boot
const Sequelize = require("sequelize");

/**
 * Actions summary:
 *
 * addColumn "boardType" to table "Games"
 * addColumn "boardOrigin" to table "Games"
 *
 **/

const info = {
  revision: 32,
  name: "board-type",
  created: "2026-07-17T00:00:00.000Z",
  comment: "",
};

module.exports = {
  up: function (queryInterface) {
    return queryInterface.sequelize.transaction(function (transaction) {
      return queryInterface
        .addColumn(
          "Games",
          "boardType",
          {
            type: Sequelize.STRING,
            defaultValue: "classic",
          },
          { transaction }
        )
        .then(function () {
          return queryInterface.addColumn(
            "Games",
            "boardOrigin",
            {
              type: Sequelize.JSONB,
              defaultValue: { x: 0, y: 0 },
            },
            { transaction }
          );
        });
    });
  },
  down: function (queryInterface) {
    return queryInterface.sequelize.transaction(function (transaction) {
      return queryInterface
        .removeColumn("Games", "boardType", { transaction })
        .then(function () {
          return queryInterface.removeColumn("Games", "boardOrigin", {
            transaction,
          });
        });
    });
  },
  info: info,
};
