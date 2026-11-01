import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'auth-db1408.hstgr.io',
  user: process.env.DB_USER || 'u339048620_stkreq',
  password: process.env.DB_PASSWORD || '8yc7zuc8z*A',
  database: process.env.DB_NAME || 'u339048620_stkreq',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

export default pool;
