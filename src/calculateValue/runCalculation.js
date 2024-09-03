const { getEstimatedBudgetsTotal } = require('../services/services');

const REGION_ISO = 'PL';

const calculateValue = async (job) => {
  const { id, ...restOfRequest } = job;
  const formattedRequest = { ...restOfRequest };
  const { estimatedBudgets } = await getEstimatedBudgetsTotal(REGION_ISO, formattedRequest);
  const resultArr = estimatedBudgets.map((budget) => {
    const { id: dbId, ...restOfResponse } = budget;
    return {
      id,
      ...restOfResponse,
    };
  });

  return resultArr;
};

module.exports = { calculateValue };
