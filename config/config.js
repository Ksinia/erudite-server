export default {
  development: {
    username: "postgres",
    password: "secret",
    database: "erudite",
    host: "127.0.0.1",
    dialect: "postgres",
    logging: false,
  },
  production: {
    use_env_variable: "DATABASE_URL",
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
    logging: false,
  },
};
