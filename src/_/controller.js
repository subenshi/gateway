const http = require('./http');
const nats = require('./nats');
const addons = require('./addons');

module.exports.connect = async (cb) => {
  await addons.init();
  await nats.connect();
  await http.connect(cb);
}