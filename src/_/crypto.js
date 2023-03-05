const crypto = require('crypto');

module.exports.uuid = () => {
  return crypto.randomUUID();
};