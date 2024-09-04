const mongo = require('../database/index');
const { getQueue } = require('../queue');

const DIVISION_NAME = '7-request';

const productCardProducer = async () => {
  await mongo.connectToDatabase();
  const requestsCollection = mongo.getCollection(DIVISION_NAME);
  const inputDataArray = await requestsCollection.find({}).toArray();

  console.log(`\n startScraperQueue:${process.pid}`);

  let counter = 0;
  const translationPuppeteerQueue = getQueue('CalcBudgetCalculation');

  inputDataArray.forEach((attrUrlObj) => {
    const { _id, ...restOfData } = attrUrlObj;
    counter += 1;
    translationPuppeteerQueue.add(restOfData, { attempts: 2, backoff: 3000 });
    console.log(` Queue CalcBudgetCalculation number ${counter} was added`);
  });

  await mongo.closeConnection();
  return translationPuppeteerQueue;
};

(async () => {
  await productCardProducer();
})();
