

import dotenv from 'dotenv';
// ✅ 2. Call dotenv.config() to load .env variables
dotenv.config();
import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs/promises';
import cors from 'cors';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import {userAuthMiddleware, adminAuthMiddleware } from './src/middleware/auth.js';
import './src/db/schema.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 4000;

// PostgreSQL configuration
const pool = new Pool({
  user: process.env.db_user,
  host: process.env.db_host,
  database: process.env.db_name,
  password: process.env.db_pw,
  port: process.env.db_port,
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// JWT secret
const JWT_SECRET = process.env.secret_key;

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
  try {
    await fs.access('./uploads');
  } catch {
    await fs.mkdir('./uploads');
  }
};
ensureUploadsDir();

// // Middleware to verify JWT
// const authenticateToken = (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];
//   if (!token) return res.status(401).json({ error: 'Access denied' });

//   jwt.verify(token, JWT_SECRET, (err, user) => {
//     if (err) return res.status(403).json({ error: 'Invalid token' });
//     req.user = user;
//     next();
//   });
// };

// Admin login
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    const admin = result.rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: admin.id, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Client login
app.post('/client/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM clients WHERE username = $1', [username]);
    const client = result.rows[0];
    if (!client || !(await bcrypt.compare(password, client.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: client.id, role: 'client' }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Upload or update ZIP file
app.post('/admin/upload', adminAuthMiddleware, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const { filename, path: filePath, size } = req.file;
    const result = await pool.query(
      'INSERT INTO files (filename, filepath, size, upload_date) VALUES ($1, $2, $3, NOW()) ON CONFLICT (filename) DO UPDATE SET filepath = $2, size = $3, upload_date = NOW() RETURNING *',
      [filename, filePath, size]
    );
    res.json({ message: 'File uploaded successfully', file: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Client: List available files
app.get('/client/files', userAuthMiddleware, async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Access denied' });
  try {
    const result = await pool.query('SELECT id, filename, size, upload_date FROM files');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Client: Download file
app.get('/client/download/:id', userAuthMiddleware, async (req, res) => {
  if (req.user.role !== 'client') return res.status(403).json({ error: 'Access denied' });
  try {
    const result = await pool.query('SELECT filepath FROM files WHERE id = $1', [req.params.id]);
    const file = result.rows[0];
    if (!file) return res.status(404).json({ error: 'File not found' });
    res.download(file.filepath);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});