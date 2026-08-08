"use strict";

import { DataTypes, QueryInterface } from "sequelize";

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
  up: function (queryInterface: QueryInterface) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        "Games",
        "boardType",
        {
          type: DataTypes.STRING,
          defaultValue: "classic",
        },
        { transaction }
      );
      await queryInterface.addColumn(
        "Games",
        "boardOrigin",
        {
          type: DataTypes.JSONB,
          defaultValue: { x: 0, y: 0 },
        },
        { transaction }
      );
    });
  },
  down: function (queryInterface: QueryInterface) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn("Games", "boardType", {
        transaction,
      });
      await queryInterface.removeColumn("Games", "boardOrigin", {
        transaction,
      });
    });
  },
  info: info,
};
