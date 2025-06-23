import { pool } from "./connection.js";

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        role VARCHAR(10) NOT NULL DEFAULT 'admin',
        email VARCHAR(100) NOT NULL,
        password TEXT NOT NULL
      ); 

      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        role VARCHAR(10) NOT NULL DEFAULT 'client',
        email VARCHAR(100) NOT NULL,
        password TEXT NOT NULL
      ); 
      
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE, 
        filetitle VARCHAR(255) NOT NULL,
        filepath VARCHAR(255) NOT NULL,
        size BIGINT NOT NULL,
        upload_date TIMESTAMP NOT NULL
      );
    `);
    console.log("Tables created successfully.");
  } catch (error) {
    console.error("Error creating tables:", error);
  }
}

createTables();
