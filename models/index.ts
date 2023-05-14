"use strict";

import Sequelize from "sequelize";
import Umzug from "umzug";
// workaround for https://github.com/sequelize/sequelize/issues/3781
import pg from "pg";
delete pg.native;
import configs from "../config/config.js";

const env = process.env.NODE_ENV || "development";
const config = configs[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

// apply migrations
const umzug = new Umzug({
  storage: "sequelize",
  storageOptions: {
    sequelize: sequelize,
  },
  migrations: {
    params: [sequelize.getQueryInterface(), Sequelize],
    path: "./migrations",
  },
});
umzug.up();

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export { sequelize, Sequelize };
export default db;
