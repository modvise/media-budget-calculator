const Arena = require('bull-arena');
const Bull = require('bull');
const config = require('./config/environment.config');
Arena(
  {
    Bull,
    queues: [
      {
        name: 'CalcBudgetCalculation',
        hostId: 'mc',
        redis: config.redis,
      },
    ],
  },
  {
    basePath: '/',
  },
);
