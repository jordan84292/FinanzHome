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
    // DATE/DATETIME/TIMESTAMP columns vuelven como string ('YYYY-MM-DD' /
    // 'YYYY-MM-DD HH:MM:SS') en vez de Date — coincide con cómo ya están
    // tipadas todas las RowDataPacket interfaces en src/lib/db/procedures
    // (created_at, expires_at, due_date, etc. son todas `string`), y evita
    // desfases de timezone entre el Date del driver y el DATE almacenado.
    dateStrings: true,
  });
}

export const pool = createPool();
