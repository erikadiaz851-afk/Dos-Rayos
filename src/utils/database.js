import 'dotenv/config';
import pg from 'pg';
import logger from './logger.js';

const { Pool } = pg;

// Verificar que la variable existe
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida en el archivo .env');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Supabase requiere SSL
  ssl: {
    rejectUnauthorized: false,
  },

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Cuando se establece una conexión nueva
pool.on('connect', () => {
  logger.info('✅ Base de datos conectada');
});

// Si ocurre un error inesperado
pool.on('error', (err) => {
  logger.error(`❌ Error de base de datos: ${err.message}`);
});

// Función para ejecutar consultas
export const query = async (text, params = []) => {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (error) {
    logger.error(`❌ Error SQL: ${error.message}`);
    throw error;
  }
};

// Obtener cliente para transacciones
export const getClient = async () => {
  return await pool.connect();
};

export default pool;