const { getCampaignTypesByRegion } = require('../../services/services');

const getPossibleCompTypes = async (regionIso, divisions) => {
  const result = [];
  for (const division of divisions) {
    const compainTypes = await getCampaignTypesByRegion(regionIso, division);
    for (const compainType of compainTypes) {
      const resultObj = {
        divisionName: division,
        compainType,
      };
      result.push(resultObj);
    }
  }
  return result;
};

module.exports = {
  getPossibleCompTypes,
};
