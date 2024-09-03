const mongo = require('../database/index');
const { getEstimatedBudgetsTotal } = require('../services/services');
const input = require('./testInput/input.json');

const REGION_ISO = 'PL';

const calculateValue = async (run) => {
  if (run) {
    await mongo.connectToDatabase();
    let counter = 0;
    const requests = input;
    for (const request of requests) {
      const { id, ...restOfRequest } = request;
      const formattedRequest = { ...restOfRequest };
      counter++;
      console.log({ counter });
      const { estimatedBudgets } = await getEstimatedBudgetsTotal(REGION_ISO, formattedRequest);
      const resultArr = estimatedBudgets.map((budget) => {
        const { id: dbId, ...restOfResponse } = budget;
        return {
          id,
          ...restOfResponse,
        };
      });
      const resultCollection = mongo.getCollection('result');
      await resultCollection.insertMany(resultArr);
    }
    await mongo.closeConnection();
  }
};

calculateValue(true).then(console.log).catch(console.error);
