const { JSONCodec, Empty, connect } = require('nats')
const env = require('./env');
const crypto = require('./crypto');
const log = require('./log');
const package = require('./package');

// to create a connection to a nats-server:
let nc

/**
 * Replies to a NATS message
 * 
 * @param {Object} message Original message from NATS
 * @param {Object} body 
 * @param {Boolean} body.isError Indicates if the response is an error
 * @param {Number} body.code HTTP status code
 * @param {Object} body.data Data to be sent back to the requester
 * @param {Object} originalMessage Original message from NATS
 */
module.exports.respond = (message, body, originalMessage) => {
  const sc = JSONCodec();

  let natsMesssage = {
    uuid: crypto.uuid(),
    timestamp: new Date().toISOString(),
    application: {
      from: package.name,
      to: originalMessage.application.from,
    },
    payload: body,
    original: originalMessage.original,
  };

  message.respond(sc.encode(natsMesssage));
}


/**
 * 
 * @param {*} topic 
 * @param {*} messageCallback 
 */
module.exports.subscribe = async (topic, messageCallback) => {
  if (topic) {
    log.log('nats', 'subscribed', { topic })
    const subscriptoin = nc.subscribe(topic);
    for await (const m of subscriptoin) {
      const sc = JSONCodec();
      const message = sc.decode(m.data);
      messageCallback(m, message);
    }
  }
}

/**
 * @param {String} topic Topic to end the request to
 * @param {Object} message Request from the gateway
 * @param {Object} message.application Queue applicaiton info
 * @param {String} message.application.from Where the message came from
 * @param {String} message.application.to Where the message goes to
 * @param {Object} message.payload The data to be treated by the targeted microservice
 * @param {Object} message.payload.query Query parameters
 * @param {Object} message.payload.body Body parameters
 * @param {Object} message.original Original request info
 * @param {String} message.original.uuid Unique ID of the request
 * @param {String} message.original.application Name of the application that originated the message chain
 * @param {String} message.original.timestamp Timestamp of the original request
 * @param {String} message.original.url URL of the request
 * @param {Object} opts Options for the NATS request
 * @param {Object} opts.timeout Timeout for the NATS reply to come back
 */
module.exports.request = async (topic, message, opts) => {
  if (!nc) {
    throw new Error('NATS connection not initialized');
  };

  if (!opts) opts = { timeout: 5000 };
  const sc = JSONCodec();

  return nc.request(topic, sc.encode(message), { timeout: opts.timeout })
    .then((response) => {
      return sc.decode(response.data)
    })
    .catch((err) => {
      message.application.to = package.name;
      message.error = {
        code: err.code === 'TIMEOUT' ? 408 : 505,
        data: {
          error: err.code === 'TIMEOUT' ? 'Request timed out' : 'Server error',
        }
      };
      throw message;
    });
}

/**
 * Connects to NATS
 * @returns 
 */
module.exports.connect = async () => {
  if (nc) return true;
  const server = env.get('NATS_SERVER')
  if (!server) throw new Error('NATS_SERVER not set');

  const connectionOptions = {
    servers: env.get('NATS_SERVER'),
    json: true,
  };

  log.log('nats', 'connecting', connectionOptions);

  nc = await connect(connectionOptions);
  log.log('nats', 'connected', nc.getServer());
  return true;
}

/**
 * Ensures NATS connection is initialized and calls the callback
 * @param {*} cb 
 */
module.exports.connected = (cb) => {
  if (nc) cb();
  else {
    this.connect()
      .then(() => {
        cb();
      })
  }
}

/**
 * Publishes a message to a NATS topic
 * 
 * @param {*} topic 
 * @param {*} message 
 */
module.exports.publish = async (topic, message) => {
  if (!nc) {
    throw new Error('NATS connection not initialized');
  };
  log.log('nats', 'published', { topic, message });
  const sc = JSONCodec();
  const payload = sc.encode(message);
  nc.publish(topic, payload);
}
module.exports.send = this.publish

module.exports.close = async () => {
  if (nc) {
    await nc.drain();
    nc.close();
    log.log('nats', 'closed');
  }
};