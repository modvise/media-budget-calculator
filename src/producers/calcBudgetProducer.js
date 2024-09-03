const mongo = require('../database/index');
const { getQueue } = require('../queue');

// const inputDataArray = require('../calculateValue/testInput/input.json');

const START_FROM = 0; // * next START_FROM will be starting from END
const END = 1000;

// const inputData = inputDataArray.slice(START_FROM, END);

const DIVISION_NAME = 'cpd-hair-care-request';

const productCardProducer = async () => {
  await mongo.connectToDatabase();
  const requestsCollection = mongo.getCollection(DIVISION_NAME);
  const inputDataArray = await requestsCollection.find({}).toArray();

  const inputData = inputDataArray.slice(START_FROM, END);
  console.log(`\n startScraperQueue:${process.pid}`);

  let counter = 0;
  const translationPuppeteerQueue = getQueue('CalcBudgetCalculation');

  inputData.forEach((attrUrlObj, ind) => {
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
