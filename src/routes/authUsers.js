import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../utils/database.js';
import logger from '../utils/logger.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dos-rayos-secret-2026';

export async function createUsersTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      email      VARCHAR(255) UNIQUE NOT NULL,
      password   VARCHAR(255) NOT NULL,
      role       VARCHAR(20) DEFAULT 'viewer',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  logger.info('Tabla users lista');
}

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token inválido' });
  }
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'Faltan campos' });
    const exists = await query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length > 0)
      return res.status(400).json({ success: false, error: 'El email ya está registrado' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      'INSERT INTO users (name,email,password) VALUES ($1,$2,$3) RETURNING id,name,email,role',
      [name, email, hash]
    );
    const token = jwt.sign(
      { id: rows[0].id, email, role: rows[0].role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ success: true, token, user: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
    const { rows } = await query('SELECT * FROM users WHERE email=$1', [email]);
    if (!rows.length)
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid)
      return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    const token = jwt.sign(
      { id: rows[0].id, email: rows[0].email, role: rows[0].role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({
      success: true, token,
      user: { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id,name,email,role,created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    res.json({ success: true, user: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada' });
});

export default router;