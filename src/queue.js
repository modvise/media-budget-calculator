const Queue = require('bull');
const parseDbUrl = require('parse-database-url');

const config = require('./config/environment.config');

const getQueue = (name) => {
  console.log(' Adding queue:', name);
  const tlsOptions =
    config.TLS_REQUIRED === 'true'
      ? {
          connectTimeout: 30000,
          tls: {},
        }
      : {};
  const queue = new Queue(name, {
    redis: {
      ...parseDbUrl(config.REDIS_URL),
      ...tlsOptions,
    },
  });

  ['error', 'failed'].forEach((event) => {
    queue.on(event, async (job, err) => {
      console.log(`job:${event}:${process.pid}`, job.data, err);
      if (err) {
        console.log('Error: ');
        console.log(err);
      }
    });
  });

  return queue;
};

const cleanQueue = (name) => {
  const queue = getQueue(name);
  const clean = queue.clean.bind(queue, 0);
  return queue
    .pause()
    .then(clean('completed'))
    .then(clean('active'))
    .then(clean('delayed'))
    .then(clean('failed'))
    .then(() => queue.empty())
    .then(() => queue.close());
};

module.exports = {
  getQueue,
  cleanQueue,
};
