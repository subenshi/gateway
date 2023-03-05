// Set environment variables from .env file
const fs = require('fs');
const path = require('path');

module.exports.set = () => {
  if (this.get('NODE_ENV') === 'production') return;

  // Check if .env file exists
  const envPath = path.join(__dirname, '..', '..', '.env');

  if (fs.existsSync(envPath)) {
    // Read .env file
    const envConfig = fs.readFileSync(envPath, 'utf8');
    // Set environment variables
    envConfig.split(/\r?\n/).forEach((env) => {
      if (!env.includes('=')) return;
      // Split by the first = sign only
      const envPair = env.split(/=(.+)/);
      const [key, value] = envPair;
      process.env[key.trim()] = value.trim();
    });
  }
};

module.exports.get = (key) => {
  return process.env[key] || null
};

this.set();