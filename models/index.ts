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
    pattern: /\.ts$/,
  },
});
const existingMigrations = [
  "01-init.ts",
  "02-noname.ts",
  "03-noname.ts",
  "04-noname.ts",
  "05-noname.ts",
  "06-noname.ts",
  "07-noname.ts",
  "08-noname.ts",
  "09-noname.ts",
  "10-noname.ts",
  "11-language.ts",
  "12-noname.ts",
  "13-noname.ts",
  "14-noname.ts",
  "15-noname.ts",
  "16-noname.ts",
  "17-noname.ts",
  "18-noname.ts",
  "19-remove-rooms.ts",
  "20-noname.ts",
  "21-add-visit-column.ts",
  "22-noname.ts",
  "23-noname.ts",
  "24-noname.ts",
  "25-jsonb.ts",
  "26-active-user.ts",
  "27-subscription.ts",
  "28-add-email-confirmed.ts",
];

const seedMigrations = async () => {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "SequelizeMeta" (name VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY)`
  );
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) as count FROM "SequelizeMeta"`
  );
  const hasExistingMigrations =
    parseInt((rows as { count: string }[])[0].count) > 0;
  if (hasExistingMigrations) {
    await sequelize.query(`DELETE FROM "SequelizeMeta" WHERE name LIKE '%.js'`);
    for (const name of existingMigrations) {
      await sequelize.query(
        `INSERT INTO "SequelizeMeta" (name) VALUES (:name) ON CONFLICT DO NOTHING`,
        { replacements: { name } }
      );
    }
  }
};

export const migrationsReady = seedMigrations()
  .then(() => umzug.up())
  .then((migrations) => {
    if (migrations.length > 0) {
      console.log(
        "Migrations applied:",
        migrations.map((m) => m.file)
      );
    }
  });

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export { sequelize, Sequelize };
export default db;
