const Queue = require('bull');
const mongo = require('../database/index');
const config = require('../config/environment.config');
const { calculateValue } = require('../calculateValue/runCalculation');
const config = require('../config/environment.config');

// const DIVISION_NAME = '7-result'; // per division fort testing

const calcDataQueue = new Queue('CalcBudgetCalculation', { redis: config.REDIS_URL });
async function productCardProcess() {
  await mongo.connectToDatabase();
  let counter = 0;
  const { waiting } = await calcDataQueue.getJobCounts();

  calcDataQueue.process('*', config.PROCESS_AMOUNT, async (job, done) => {
    counter += 1;
    console.log('----------------------------------------------------------------');
    console.log(`                ${counter}/${waiting}`);
    console.log('----------------------------------------------------------------');
    try {
      const result = await calculateValue(job.data);
      const resultCollection = mongo.getCollection('result');

      // for current collection --------------------------------
      // const currentResultCollection = mongo.getCollection(DIVISION_NAME); // per division fort testing
      // await currentResultCollection.insertMany(result); // per division fort testing
      // -------------------------------------------------------

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
