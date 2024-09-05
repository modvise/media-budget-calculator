const { getEstimatedBudgetsTotal } = require('../services/services');
const { formatDate } = require('../utils/formatDate');

const REGION_ISO = 'PL';

const calculateValue = async (job) => {
  const { id, _id, touchpoints, ...restOfRequest } = job;
  const formattedRequest = { ...restOfRequest };

  const [year, month, day] = formattedRequest.campaignStartDate.split('-');
  const formattedStartDate = `${day}-${month}-${year}`;

  const formattedEndDate = formatDate(formattedRequest.campaignEndDate);

  const { estimatedBudgets } = await getEstimatedBudgetsTotal(REGION_ISO, formattedRequest);
  const resultArr = estimatedBudgets.map((budget) => {
    const { id: dbId, ...restOfResponse } = budget;

    return {
      id,
      ...restOfResponse,
      ...formattedRequest,
      campaignStartDate: formattedStartDate,
      campaignEndDate: formattedEndDate,
    };
  });

  return resultArr;
};

module.exports = { calculateValue };
