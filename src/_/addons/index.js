const log = require('../log');

module.exports.keycloack = require('./keycloack');

module.exports.init = async () => {
  log.log('addons', 'Initializing addons...')
  await this.keycloack.init();
}