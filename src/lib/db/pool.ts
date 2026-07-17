import mysql from 'mysql2/promise';

// Aiven (and most managed MySQL hosts) require TLS; local XAMPP does not
// support it at all, so this only activates when DB_SSL is explicitly set.
function buildSslConfig(): mysql.SslOptions | undefined {
  if (process.env.DB_SSL !== 'true') {
    return undefined;
  }
  return { rejectUnauthorized: false };
}

function createPool(): mysql.Pool {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
    ssl: buildSslConfig(),
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
    // Sin esto, mysql2 serializa parámetros Date (ej. expiresAt en
    // createPasswordResetToken) usando la zona horaria LOCAL de la máquina que
    // corre Node, no UTC. Si esa máquina y el servidor de MySQL/MariaDB no
    // coinciden en zona horaria (ej. dev en Costa Rica UTC-6 contra Aiven en
    // UTC), el valor escrito queda desalineado con el NOW() del servidor —
    // se detectó como un token de reset "ya vencido" apenas creado al probar
    // contra Aiven. 'Z' fuerza que el driver siempre trate los Date como UTC.
    timezone: 'Z',
  });

  // La sesión del servidor también debe operar en UTC para que NOW()/CURDATE()
  // concuerden con lo que el driver acaba de escribir en UTC (arriba).
  pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });

  return pool;
}

export const pool = createPool();
