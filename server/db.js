import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dbHost = (process.env.DB_HOST && process.env.DB_HOST.trim()) || 'auth-db1408.hstgr.io';
const dbUser = (process.env.DB_USER && process.env.DB_USER.trim()) || 'u339048620_stk';
const dbPassword = (process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim()) || '8yc7zuc8z*A';
const dbName = (process.env.DB_NAME && process.env.DB_NAME.trim()) || 'u339048620_stk';
const dbPort = Number(process.env.DB_PORT) || 3306;

const pool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  port: dbPort,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

export default pool;
