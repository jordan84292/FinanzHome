import mysql from 'mysql2/promise';

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    // DECIMAL columns vuelven como number en vez de string — más simple para
    // matemática de montos en una app de este tamaño.
    decimalNumbers: true,
  });
}

export const pool = createPool();
