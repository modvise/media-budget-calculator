const Queue = require('bull');
const mongo = require('../database/index');
const config = require('../config/environment.config');
const { calculateValue } = require('../calculateValue/runCalculation');

const calcDataQueue = new Queue('CalcBudgetCalculation', { redis: config.REDIS_URL });
async function productCardProcess() {
  await mongo.connectToDatabase();
  let counter = 0;
  const { waiting } = await calcDataQueue.getJobCounts();

  calcDataQueue.process('*', 8, async (job, done) => {
    counter += 1;
    console.log('----------------------------------------------------------------');
    console.log(`                ${counter}/${waiting}`);
    console.log('----------------------------------------------------------------');
    try {
      const result = await calculateValue(job.data);
      const resultCollection = mongo.getCollection('result');
      await resultCollection.insertMany(result);
      console.log(`Process number: ${process.pid}`);
      done();
    } catch (error) {
      console.log(error);
      process.exit(1);
    }
  });
}

(async () => {
  await productCardProcess();
  // console.log('FINISHED');

  // await mongo.closeConnection();
})();
