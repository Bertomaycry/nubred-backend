import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} - True if passwords match
 */
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

/**
 * Generate an access token for a user
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string} - JWT access token
 */
export const generateAccessToken = (userId, email) => {
  return jwt.sign(
    { id: userId, email: email },
    process.env.ACCESS_TOKEN_SECRET_KEY,
    {
      expiresIn: '20m',
    }
  );
};

/**
 * Generate a refresh token for a user
 * @param {string} userId - User ID
 * @returns {string} - JWT refresh token
 */
export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.REFRESH_TOKEN_SECRET_KEY,
    {
      expiresIn: '1d',
    }
  );
};

/**
 * Generate both access and refresh tokens for a user
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Object} - Object containing accessToken and refreshToken
 */
export const generateTokens = (userId, email) => {
  const accessToken = generateAccessToken(userId, email);
  const refreshToken = generateRefreshToken(userId);

  return {
    accessToken,
    refreshToken,
  };
};
