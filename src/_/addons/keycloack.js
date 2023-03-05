const env = require("../env");
const log = require('../log')

let client = null;
let url = null;

const KEYCLOAK_PROTOCOL = env.get("KEYCLOAK_PROTOCOL");
const KEYCLOAK_HOST = env.get("KEYCLOAK_HOST");
const KEYCLOAK_PORT = env.get("KEYCLOAK_PORT");
const KEYCLOACK_REALM_NAME = env.get("KEYCLOACK_REALM_NAME");

module.exports.ready = () => {
  if (!KEYCLOAK_PROTOCOL) {
    log.log('addons.keycloack', 'startup.ignored')
    return false;
  }

  if (!KEYCLOAK_HOST || !KEYCLOAK_PORT || !KEYCLOACK_REALM_NAME) {
    log.log('addons.keycloack', 'startup.error', { message: 'Missing Keycloack configuration' })
    return false;
  }

  return true;
}

module.exports.init = () => {
  if (!this.ready()) return;

  log.log('addons.keycloack', 'startup', { message: 'Initializing Keycloack addon'})
  
  // Load http or https module based on protocol from env
  client = require(KEYCLOAK_PROTOCOL);
  
  const KEYCLOACK_URL = `${KEYCLOAK_PROTOCOL}://${KEYCLOAK_HOST}:${KEYCLOAK_PORT}/realms/${KEYCLOACK_REALM_NAME}`;
  const KEYCLOACK_URL_USERINFO = `${KEYCLOACK_URL}/protocol/openid-connect/userinfo`;
  url = new URL(KEYCLOACK_URL_USERINFO);

  log.log('addons.keycloack', 'started', { KEYCLOACK_URL })
}

// Validate Keycloack token
module.exports.verify = headers => {
  if (!client) {
    log.log('addons.keycloack', 'error', { message: 'Client not initialized' })
  };

  if (!headers || !headers.authorization) {
    return Promise.resolve(null);
  };

  // configure the request to your keycloak server
  const options = {
    headers: {
      // add the token you received to the userinfo request, sent to keycloak
      Authorization: headers.authorization,
    },
  };

  const opts = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    headers: options.headers,
  };

  // Make a request to get the userinfo endpoint on keycloak, via http module
  return new Promise((resolve, reject) => {
    client.get(opts, res => {
      // Get response code
      const { statusCode } = res;

      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(data, statusCode)
        if (statusCode !== 200) {
          return resolve(null);
        }
        resolve(JSON.parse(data));
      });
    }).end();
  });
}