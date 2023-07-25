const _ = require('./_');

/**
 * @param {Object} message Request from the gateway
 * @param {Object} message.uuid Unique ID of the request
 * @param {Object} message.timestamp Timestamp of the request
 * @param {Object} message.application Queue applicaiton info
 * @param {String} message.application.from Where the message came from
 * @param {String} message.application.to Where the message goes to
 * @param {Object} message.payload The data to be treated by the targeted microservice
 * @param {Object} message.payload.query Query parameters
 * @param {Object} message.payload.body Body parameters
 * @param {Object} message.original Original request info
 * @param {String} message.original.uuid Unique ID of the original request
 * @param {String} message.original.application Name of the application that originated the message chain
 * @param {String} message.original.timestamp Timestamp of the original request
 * @param {String} message.original.url URL of the request
 * @param {Object} res Response object from the gateway (http.ServerResponse)
 */
_.connect(() => {
  // Subscribe to the microservice discovery topic
  _.subscribe('nats.discovery', (m, microservice) => {
    const { status } = microservice;

    if (status) console.log(JSON.stringify(microservice, null, 2))

    if (status) _.add(microservice)
    if (!status) _.remove(microservice)
  })

  // Publish a ping to the microservice discovery topic
  _.publish('nats.discovery.ping')

  // Received HTTP request from client
  _.http((natMessage, res) => {
    // Send the request to the microservice
    _.request(natMessage.application.to, natMessage, { timeout: 5000 })
      // and send the response back to the gateway's client
      .then(message => {
        _.reply(res, message)
      }) // Send the response back to the gateway's client
      .catch(replyError => {
        _.reply(res, replyError)
      });
  })
})