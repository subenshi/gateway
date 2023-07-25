// Start http server
const express = require('express');
const bodyParser = require('body-parser')
const URL = require('url');
const app = express()

const log = require('./log');
const crypto = require('./crypto');
const package = require('./package');
const microservices = require('./microservices');
const addons = require('./addons');
const validator = require('./validator');

let server;

let config;

// Check if config.json exists
try {
  config = require('../../config.json')
} catch (e) {
  config = {}
}

const PORT = process.env.PORT || 3000;

// parse application/json
app.use(bodyParser.json())

module.exports.reply = (res, message) => {
  const { properties } = message;
  const { statusCode, headers } = properties;

  if (statusCode) {
    res.status(statusCode);
  }

  if (headers) {
    Object.keys(headers).forEach(key => {
      res.setHeader(key, headers[key]);
    })
  }
  
  const { payload } = message;

  if (payload) {
    res.send(payload);
  }
  else {
    console.log(message)
    res.send('ok');
  }
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

module.exports.getParams = (route, url) => {
  let params = {
    required: [],
    list: {}
  };

  // For a URL like /api/v1/users/1/roles/2
  // and a route like /api/v1/users/:userId/roles/:roleId
  // we want to get the params like { userId: 1, roleId: 2 }

  // Split the URL and the route into arrays
  const urlParts = url.pathname.split('/');
  const routeParts = route.split('/');

  // Loop through the route parts
  routeParts.forEach((part, index) => {
    // If the part starts with a colon, it's a param
    if (part.startsWith(':')) {
      // Get the param name
      const paramName = part.replace(':', '');
      // Get the param value from the URL
      const paramValue = urlParts[index];
      // Add the param to the list
      params.list[paramName] = paramValue;
      // Add the param to the required list
      params.required.push(paramName);
    }
  });

  return params;
}

module.exports.connect = (cb) => {
  return new Promise((resolve, reject) => {

    // Security
    app.disable('x-powered-by');

    // Apply CORS config based on config.json
    if (config.http?.cors) {
      log.log('http', 'cors', config.http.cors);
      const cors = require('cors')
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

      let route = null;
      let params = {};

      const parse = URL.parse(url);
      
      log.log('http', 'route', parse.pathname);

      const microservice = micros.filter(ms => ms.config && ms.config.http).find(ms => {
        const { http } = ms.config;

        const match = http.find(route => {
          const routePathname = parse.pathname;
          if (route.method !== method) {
            // log.log('http', 'route', `${routePathname} ${route.method} != ${method}`);
            return false
          };

          let _params = this.getParams(route.pathname, parse);

          if (!_params.required.length) {
            return route.pathname === routePathname
          }

          log.log('http', 'route', `${route.pathname} ${routePathname}`);
          console.log({ _params })

          if (_params.required.length) {
            let finalPath = parse.pathname;
            
            // Remove falsy values from _params.list
            Object.keys(_params.list).forEach(key => {
              if (!_params.list[key]) {
                delete _params.list[key];
              }
            })

            // Replace the params with the values from the URL
            Object.keys(_params.list).forEach(key => {
              finalPath = finalPath.replace(_params.list[key], `:${key}`)
            })

            if (finalPath === route.pathname) {
              params = _params.list;
              return true;
            } 
          }

          return false
        })

        if (match) {
          route = match;
          return true;
        }
      });

      if (!microservice) {
        log.log('http', 'route.404', pathname);
        return res.status(404).send();
      }

      const { authentication } = microservice.config.http;

      let user = null;
      if (authentication) {
        try {
          user = await this.authenticateRequest(authentication, req.headers)
        }
        catch (e) {
          log.log('http', 'route.401', pathname);
          return res.status(401).send();
        }
      }

      // Perform validation 
      const { validate } = route;
      if (validate) {
        // The required fields to be validated
        // as per the config.json of the http microservice
        const { body, query } = validate;
        try {
          // if (body) validator(body, req.body);
          if (query) validator(query, req.query);
        }
        catch (e) {
          return res.status(400).send(e.message);
        }
      }

      const uuid = crypto.uuid();

      const natsMessage = {
        uuid,
        operation: route.operationId,
        application: {
          from: package.name,
          to: microservice.name,
        },
        payload: { url, method, query, params, body, headers, user },
        original: {
          uuid,
          application: 'gateway',
          url: pathname,
          routerId: route.routerId,
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