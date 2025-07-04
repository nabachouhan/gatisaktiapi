

// userAuthMiddleware.js

import jwt from 'jsonwebtoken';
import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
// ✅ 2. Call dotenv.config() to load .env variables
dotenv.config();

const app = express();
app.use(cookieParser());

// ✅ Middleware function
export const userAuthMiddleware = (req, res, next) => {

  const token = req.cookies.token;
  console.log("Checking token presence...");
  // console.log(req.cookies);

// ✅ Helper to decode token payload without verifying
  function parseJwt(token) {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
      return null;
    }
  }

  const decodedToken = parseJwt(token);
  const currentTime = Math.floor(Date.now() / 1000);

  if (!token) {
    console.log("Token not found. Redirecting to login.");
    return res.status(401).redirect('/index.html');

  }

  if (decodedToken?.exp < currentTime) {
        return res.status(401).redirect('/index.html');
  }

  try {
    const decoded = jwt.verify(token, process.env.clientSecretKey);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).redirect('/index.html');
  }
};





// Admin authentication middleware
export const adminAuthMiddleware = (req, res, next) => {

  // Read JWT token from cookies
  const token = req.cookies.token;
  console.log("Checking token presence...");
  console.log(req.cookies);
  

  // Helper function to decode JWT payload (without verifying signature)
  function parseJwt(token) {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
      return null;
    }
  }

  // If token is missing, redirect to login
  if (!token) {
    console.log("Token not found. Redirecting to login.");
    return res.redirect('/index.html');
  }

  // Decode token to get expiration time
  const decodedToken = parseJwt(token);
  const currentTime = Math.floor(Date.now() / 1000); // current time in seconds

  // If decoding fails or token is expired, send error response
  if (!decodedToken || decodedToken.exp < currentTime) {
    return res.redirect('/index.html');
  }

  try {
    // Verify token signature using secret key
    const decoded = jwt.verify(token, process.env.adminSecretKey);

    // Attach user info to request for downstream use
    req.user = decoded;

    // Proceed to next middleware or route
    next();
  } catch (err) {
    // If token verification fails, redirect to login
    // console.log("Token verification failed:", err);
    return res.redirect('/index.html');
  }
};