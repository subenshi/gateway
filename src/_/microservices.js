const log = require('./log')

const list = []

module.exports.add = (microservice) => {
  const { name } = microservice;
  const found = list.find(microservice => microservice.name === name);

  if (!found) {
    log.log('microservices', 'up.added', { name })
    list.push(microservice);
  }
  else {
    log.log('microservices', 'up.ignored', { name })
  }
};

module.exports.remove = (microservice) => {
  const { name } = microservice;
  const found = list.find(microservice => microservice.name === name);
  if (found) {
    log.log('microservices', 'down.removed', { name })
    list.splice(list.indexOf(found), 1);
  }
  else {
    log.log('microservices', 'down.ignored', { name })
  }
};

module.exports.list = list;