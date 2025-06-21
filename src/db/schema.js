// CREATE DATABASE file_transfer_db;

// \c file_transfer_db

// CREATE TABLE admins (
//   id SERIAL PRIMARY KEY,
//   username VARCHAR(50) UNIQUE NOT NULL,
//   password VARCHAR(100) NOT NULL
// );

// CREATE TABLE clients (
//   id SERIAL PRIMARY KEY,
//   username VARCHAR(50) UNIQUE NOT NULL,
//   password VARCHAR(100) NOT NULL
// );

// CREATE TABLE files (
//   id SERIAL PRIMARY KEY,
//   filename VARCHAR(255) NOT NULL,
//   filepath VARCHAR(255) NOT NULL,
//   size BIGINT NOT NULL,
//   upload_date TIMESTAMP NOT NULL
// );

// -- Insert sample admin (password: admin123)
// INSERT INTO admins (username, password) VALUES (
//   'admin',
//   '$2b$10$YOUR_HASHED_PASSWORD_HERE'
// );

// -- Insert sample client (password: client123)
// INSERT INTO clients (username, password) VALUES (
//   'client',
//   '$2b$10$YOUR_HASHED_PASSWORD_HERE'
// );

import { pool } from "./connection.js";

async function createTables() {
  try {
    await pool.query(`
            CREATE TABLE IF NOT EXISTS  admins(
              id SERIAL PRIMARY KEY,
              email VARCHAR(100) NOT NULL,
              password TEXT NOT NULL
            ); 

            CREATE TABLE IF NOT EXISTS  clients(
              id SERIAL PRIMARY KEY,
              email VARCHAR(100) NOT NULL,
              organization VARCHAR(100) ,
              password TEXT NOT NULL
            ); 
            
            CREATE TABLE files (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
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
