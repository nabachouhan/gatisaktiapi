import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import path from 'path';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { userAuthMiddleware, adminAuthMiddleware } from './src/middleware/auth.js';
import './src/db/schema.js';
import cookieParser from 'cookie-parser';
const app = express();
import { promises as fs } from 'fs'; // For async methods
import fsSync from 'fs'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser()); 
const port = 3000;

// PostgreSQL configuration
const pool = new Pool({
  user: process.env.db_user,
  host: process.env.db_host,
  database: process.env.db_name,
  password: process.env.db_pw,
  port: process.env.db_port,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection error:', err.stack);
    return;
  }
  console.log('Database connected successfully');
  release();
});

// Middleware
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ 
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024 // 2GB in bytes
  }
 });

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
  try {
    await fs.access('./uploads');
  } catch {
    await fs.mkdir('./uploads');
  }
};
ensureUploadsDir();

// admin login
app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
    const admin = result.rows[0];
    if (!admin || email !== admin.email || !(await bcrypt.compare(password, admin.password))) {
      const data = { message: 'Invalid Credentials!!', title: "Oops?", icon: "warning", redirect:"/admin.html" };
      return res.status(401).json(data);
    }
    const token = jwt.sign({ email: admin.email, role: admin.role }, process.env.adminSecretKey, { expiresIn: '10m' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    // res.json({ token }); // Add this to return the token
    console.log(token);
    const data = { message: 'Proceed Login!!', title: "", icon: "warning", redirect:"/admin.html" };
    res.status(200).json(data);  } catch (err) {
    console.error('Error in /admin/login:', err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Client login
app.post('/client/login', async (req, res) => {
  try {
  const {email, password } = req.body;
    const result = await pool.query('SELECT * FROM clients WHERE email = $1', [email]);
    const client = result.rows[0];
    if (!client || email!=client.email || !(await bcrypt.compare(password, client.password))) {
      const data = { message: 'Invalid Credentials!!', title: "Oops?", icon: "warning", redirect:"/admin.html" };
      return res.status(401).json(data);
    }
    const token = jwt.sign({ email: client.email, role: client.role }, process.env.clientSecretKey, { expiresIn: '10m' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    // res.json({ token }); // Add this to return the token
    console.log(token);
    const data = { message: 'Proceed Login!!', title: "", icon: "warning", redirect:"/client.html" };
    res.status(200).json(data);
  } catch (err) {
    console.error('Error in /admin/login:', err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Admin: Upload or update ZIP file
app.post('/admin/upload', adminAuthMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      console.log('Access denied: User is not admin', req.user);
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, path: filePath, size } = req.file;
    const fileTitle = req.body.fileTitle || filename;
    const department = req.body.department  || ASSAC;
    const description = req.body.description  || ASSAC;

    console.log('Uploading file:', { filename, fileTitle, filePath, size });

   const result = await pool.query(
  `INSERT INTO files (department, filename, filetitle, filepath, size, description, upload_date)
   VALUES ($1, $2, $3, $4, $5, $6, NOW())
   ON CONFLICT (filename) DO UPDATE
     SET filetitle = $3,
         filepath = $4,
         size = $5,
         description = $6,
         upload_date = NOW()
   RETURNING *`,
  [department, filename, fileTitle, filePath, size, description]
);

    res.json({ message: 'File uploaded successfully', file: result.rows[0] });
  } catch (err) {
    console.error('Error in /admin/upload:', err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Admin: List files with pagination and search
app.get('/admin/files', adminAuthMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      console.log('Access denied: User is not admin', req.user);
      return res.status(403).json({ error: 'Access denied' });
    }
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 5;
    const search = req.query.search || '';
    const offset = (page - 1) * size;
    console.log('Fetching files:', { page, size, search, offset });

    const searchQuery = `%${search}%`;
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM files WHERE filename ILIKE $1 OR filetitle ILIKE $1',
      [searchQuery]
    );
    const totalFiles = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalFiles / size);

    const result = await pool.query(
      'SELECT id, department, filename, filetitle, size, upload_date, description, status FROM files WHERE filename ILIKE $1 OR filetitle ILIKE $1 ORDER BY upload_date DESC LIMIT $2 OFFSET $3',
      [searchQuery, size, offset]
    );
    res.json({ files: result.rows, currentPage: page, totalPages });
  } catch (err) {
    console.error('Error in /admin/files:', err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Admin: Replace file
app.put('/admin/replace/:id', adminAuthMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      console.log('Access denied: User is not admin', req.user);
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = req.params.id;
    const { filename, path: filePath, size } = req.file;
    const oldFile = await pool.query('SELECT filepath FROM files WHERE id = $1', [fileId]);
    if (!oldFile.rows[0]) return res.status(404).json({ error: 'File not found' });

    // Delete old file
    try {
      await fs.unlink(oldFile.rows[0].filepath);
    } catch (err) {
      console.warn('Could not delete old file:', err.message);
    }

    const result = await pool.query(
      'UPDATE files SET filename = $1, filepath = $2, size = $3, upload_date = NOW(), status = $4 WHERE id = $5 RETURNING *',
      [filename, filePath, size, 'update', fileId]
    );
     await pool.query(`UPDATE files SET status='update' WHERE id = $1`, [req.params.id]);

    res.json({ message: 'File replaced successfully', file: result.rows[0] });
  } catch (err) {
    console.error('Error in /admin/replace:', err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Admin: Delete file
app.delete('/admin/delete/:id', adminAuthMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      console.log('Access denied: User is not admin', req.user);
      return res.status(403).json({ error: 'Access denied' });
    }
    const fileId = req.params.id;
    const file = await pool.query('SELECT filepath FROM files WHERE id = $1', [fileId]);
    if (!file.rows[0]) return res.status(404).json({ error: 'File not found' });

    try {
      await fs.unlink(file.rows[0].filepath);
    } catch (err) {
      console.warn('Could not delete file:', err.message);
    }
    await pool.query('DELETE FROM files WHERE id = $1', [fileId]);
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('Error in /admin/delete:', err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Admin: Cleanup unreferenced files
app.post('/admin/cleanup', adminAuthMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      console.log('Access denied: User is not admin', req.user);
      return res.status(403).json({ error: 'Access denied' });
    }

    const filesInDb = await pool.query('SELECT filepath FROM files');
    const dbFilePaths = new Set(filesInDb.rows.map(row => row.filepath));
    const uploadDir = path.join(__dirname, 'uploads');
    const filesInDir = await fs.readdir(uploadDir);

    let deletedCount = 0;
    for (const file of filesInDir) {
      const filePath = path.join(uploadDir, file);
      if (!dbFilePaths.has(filePath)) {
        try {
          await fs.unlink(filePath);
          console.log(`Deleted unreferenced file: ${filePath}`);
          deletedCount++;
        } catch (err) {
          console.warn(`Could not delete unreferenced file ${filePath}:`, err.message);
        }
      }
    }
    res.json({ message: `Cleanup completed, deleted ${deletedCount} unreferenced files` });
  } catch (err) {
    console.error('Error in /admin/cleanup:', err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Client: List available files with pagination and search
// Client: List available files with pagination, search, and status filter
app.get('/client/files', userAuthMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      console.log('Access denied: User is not client', req.user);
      return res.status(403).json({ error: 'Access denied' });
    }

    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 5;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const offset = (page - 1) * size;

    console.log('Fetching client files:', { page, size, search, status, offset });

    const searchQuery = `%${search}%`;
    let queryParams = [searchQuery];
    let statusCondition = '';
    let paramIndex = 2;

    if (status !== 'all') {
      statusCondition = ` AND status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    // Count query
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM files WHERE (filename ILIKE $1 OR filetitle ILIKE $1)${statusCondition}`,
      queryParams
    );
    const totalFiles = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalFiles / size);

    // Data query
    queryParams.push(size, offset); // for LIMIT and OFFSET
    const result = await pool.query(
      `SELECT id, department, filename, filetitle, size, description, upload_date, status
       FROM files
       WHERE (filename ILIKE $1 OR filetitle ILIKE $1)${statusCondition}
       ORDER BY upload_date DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );

    res.json({ files: result.rows, currentPage: page, totalPages });

  } catch (err) {
    console.error('Error in /client/files:', err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});
// View (returns GeoJSON content)
app.get('/client/view/:id', userAuthMiddleware, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [id]);
    const file = result.rows[0];
    if (!file) return res.status(404).json({ error: 'File not found' });

    const fileData = fsSync.readFileSync(file.filepath, 'utf8');
    res.setHeader('Content-Type', 'application/geo+json');
    res.send(fileData); // sends raw GeoJSON text
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error reading GeoJSON' });
  }
});


// Client: Download file
app.get('/client/download/:id', userAuthMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      console.log('Access denied: User is not client', req.user);
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await pool.query('SELECT filepath FROM files WHERE id = $1', [req.params.id]);
    const file = result.rows[0];
    if (!file) return res.status(404).json({ error: 'File not found' });
    res.download(file.filepath);
    await pool.query(`UPDATE files SET status='downloaded' WHERE id = $1`, [req.params.id]);
  } catch (err) {
    console.error('Error in /client/download:', err.stack);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// logout
app.post('/clientlogout', userAuthMiddleware, (req, res) => {
console.log("logout");

    try {
        // Clear the cookie containing the token
        res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

        // Send a success response
        const data = { message: 'Logout successful', title: "Logged Out", icon: "success", redirect: '\\index.html' };
        console.log(data)
        return res.json(data);
    } catch (error) {
        console.error(error);
        const data = { message: 'Logout failed', title: "Error", icon: "error" };

        return res.status(500).json(data);
    }

});

app.post('/adminlogout', adminAuthMiddleware, (req, res) => {
    try {
        // Clear the cookie containing the token
        res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

        // Send a success response
        const data = { message: 'Logout successful', title: "Logged Out", icon: "success", redirect: '\\index.html' };
        console.log(data)
        return res.json(data);
    } catch (error) {
        console.error(error);
        const data = { message: 'Logout failed', title: "Error", icon: "error" };

        return res.status(500).json(data);
    }

});

// Serve HTML pages
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/admin.html', adminAuthMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get('/client.html', userAuthMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch-all for 404 errors
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});