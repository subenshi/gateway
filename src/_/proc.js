const nats = require('./nats');
const http = require('./http');
const log = require('./log');

const closeAll = async (signal) => {
  log.log('shuthdown', 'closeAll', { signal });
  await nats.close();
  await http.close();
  process.exit(0);
};

process.on('SIGINT', async () => await closeAll('SIGINT'));
process.on('SIGTERM', async () => await closeAll('SIGTERM'));
process.on('SIGUSR2', async () => await closeAll('SIGUSR2'));
process.on('exit', async () => await closeAll('exit'));