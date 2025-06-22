import { pool } from '../db/connection.js';
import bcrypt from 'bcrypt';


const addAdmin = async () => {
  const username = 'admin'; // Replace with desired username
  const email = 'admin@google.com'; // Replace with desired username
  const password = 'gatisakti@123'; // Replace with desired password
  const saltRounds = 10;

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await pool.query(
      'INSERT INTO admins (username, email, password) VALUES ($1, $2, $3)',
      [username, email, hashedPassword]
    );
    console.log(`Admin user ${username} added successfully`);
  } catch (err) {
    console.error('Error adding admin user:', err);
  } finally {
    await pool.end();
  }
};

const addClient = async () => {
  const username = 'admin'; // Replace with desired username
  const email = 'admin@google.com'; // Replace with desired username
  const password = 'gatisakti@123'; // Replace with desired password
  const saltRounds = 10;

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await pool.query(
      'INSERT INTO clients (username, email, password) VALUES ($1, $2, $3)',
      [username, email, hashedPassword]
    );
    console.log(`Admin user ${username} added successfully`);
  } catch (err) {
    console.error('Error adding admin user:', err);
  } finally {
    await pool.end();
  }
};


// addAdmin();
addClient()