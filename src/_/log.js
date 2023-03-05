const package = require('./package');
const started = new Date()

const maskFields = [
  'password'
]

module.exports.maskSensitive = (obj, forceFields) => {
  if (!forceFields) forceFields = maskFields;
  if (obj) {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (forceFields.includes(key)) {
          obj[key] = '<masked>';
        } else if (typeof obj[key] === 'object') {
          obj[key] = this.maskSensitive(obj[key], forceFields);
        }
      }
    }
  }
  return obj;
}

const trigger = (level, action, message, data) => {
  let log = {
    level,
    system: package.name.toUpperCase(),
    version: package.version,
    action: action.toUpperCase(),
  };
  if (message) log.message = message;

  // Mask sensitive data, recursively, from the data object
  data = data ? this.maskSensitive(data) : null;

  log.data = data;
  log.timestamp = new Date().toISOString();
  log.uptime = (new Date() - started) / 1000;

  console[level](JSON.stringify(log));
}

module.exports.log = (action, message, data) => trigger('log', action, message, data);
module.exports.error = (action, message, data) => trigger('error', action, message, data);
module.exports.debug = (action, message, data) => trigger('debug', action, message, data);

this.log('started');