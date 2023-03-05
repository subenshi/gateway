// Start http server
const express = require('express');
const URL = require('url');
const app = express()

const log = require('./log');
const crypto = require('./crypto');
const package = require('./package');
const microservices = require('./microservices');
const addons = require('./addons');

let server;

let config;

// Check if config.json exists
try {
  config = require('../../config.json')
} catch (e) {
  config = {}
}

const PORT = process.env.PORT || 3000;

app.use(express.json());

module.exports.reply = (res, response) => {
  if (response.code) {
    res.status(response.code);
  }
  res.send(response.data || {});
}

requestCallback = null;
module.exports.request = (cb) => {
  requestCallback = cb;
}

/**
 * 
 * @param {Object} authentication - Authentication object from microservice config 
 * @param {Object} headers - Headers from the request
 * @returns 
 * @todo Add support for other authentication providers other than Keycloak
 */
module.exports.authenticateRequest = async (authentication, headers) => {
  // At the moment only Keycloak is supported
  if (!addons.keycloack.ready()) {
    throw new Error('Keycloak addon not ready');
  }

  const { type, requirement } = authentication;

  const allowedTypes = ['bearer'];
  if (!allowedTypes.includes(type)) {
    throw new Error(`Non-supported authentication type: ${type}`);
  }

  const isMandatory = requirement === 'required';
  const isOptional = requirement === 'optional';

  // Has authorization header
  const hasAuthorizationHeader = headers.authorization;

  if (isMandatory && !hasAuthorizationHeader) {
    throw new Error('Missing authorization header');
  }

  if (isOptional && !hasAuthorizationHeader) {
    return null;
  }

  if (type === 'bearer') {
    // Has authorization header
    if (headers.authorization) {
      const verification = await addons.keycloack.verify(headers);
      if (!verification) {
        throw new Error('Invalid token');
      }
      return verification;
    }
  }
  else {
    throw new Error(`Invalid authentication type: ${type}`);
  }
  
}

module.exports.connect = (cb) => {
  return new Promise((resolve, reject) => {

    // Security
    app.disable('x-powered-by');

    // Apply CORS config based on config.json
    if (config.http?.cors) {
      log.log('http', 'cors', config.http.cors);
      var cors = require('cors')
      app.use(cors(config.http.cors));
    }

    // Loop through all the folders in the parent directory
    // and require them

    app.use(async (req, res, next) => {
      const timestamp = new Date().toISOString();
      const micros = microservices.list.filter(micro => micro.config.http);

      // Log URL
      const { url, query, body, headers, method } = req;
      const { pathname } = URL.parse(url);
      // Find the microservice that is gatewaying this URL

      const microservice = micros.filter(ms => ms.config && ms.config.http).find(ms => {
        const { http } = ms.config;
        console.log({ http, pathname, method })
        return http.pathname === pathname && 
               http.method === method;
      });

      if (!microservice) {
        log.log('http', 'route.404', pathname);
        return res.status(404).send();
      }

      const { authentication } = microservice.config.http;

      let user = null;
      if (authentication) {
        user = await this.authenticateRequest(authentication, req.headers)
      }

      const uuid = crypto.uuid();

      const natsMessage = {
        uuid,
        application: {
          from: package.name,
          to: microservice.name,
        },
        payload: { url, method, query, body, headers, user },
        original: {
          uuid,
          application: 'gateway',
          url: pathname,
          timestamp
        },
        timestamp
      }

      if (requestCallback) requestCallback(natsMessage, res);
    });

    server = app.listen(PORT, () => {
      log.log('http', 'listening', {port: PORT});
      cb();
      resolve();
    })
  });
};

module.exports.close = async () => {
  if (server) await server.close(() => {
    log.log('http', 'closed');
  })
}