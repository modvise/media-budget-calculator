const dotenv = require('dotenv');
dotenv.config();

const config = {
  WORKERS: 1,
  REDIS_URL: process.env.REDIS_URL,
  DB_CONN_STRING: process.env.DB_CONN_STRING,
  DB_NAME: process.env.DB_NAME,
  DB_LOG_NAME: process.env.DB_LOG_NAME,
  redis: {
    port: Number(process.env.REDIS_PORT),
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD,
  },
};

module.exports = config;

