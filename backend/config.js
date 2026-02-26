// backend/config.js

module.exports = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'showroom_db',
    // other options if needed
  },
  jwtSecret: process.env.JWT_SECRET || 'your_default_secret'
};
