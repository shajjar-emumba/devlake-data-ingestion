import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

let pool = null;

export async function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || "lake",
    waitForConnections: true,
    connectionLimit: 5,
    timezone: "Z",
  });

  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
