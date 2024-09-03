const { getCampaignAttributesData } = require('../../services/services');

const getPossibleCompAttr = async (regionIso, requests) => {
  const result = [];
  for (const request of requests) {
    const { divisionName, compainType } = request;
    const { campaignDurationMax, campaignDurationMin, bumperRecommended } =
      await getCampaignAttributesData(regionIso, divisionName, compainType);

    for (let i = campaignDurationMin; i <= campaignDurationMax; i++) {
      const resultObj = {
        divisionName,
        campaignTypeName: compainType,
        campaignDuration: i,
        campaignBumper: bumperRecommended || 0.4,
      };

      result.push(resultObj);
    }
  }
  return result;
};

module.exports = {
  getPossibleCompAttr,
};
