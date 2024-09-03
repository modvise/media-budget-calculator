const { getTouchpointsByRegion } = require('../../services/services');

const getPossibleTouchPoints = async (regionIso, requests) => {
  const result = [];

  for (const request of requests) {
    const { campaignTypeName, divisionName } = request;
    const touchpoints = await getTouchpointsByRegion(regionIso, campaignTypeName, divisionName);

    const { meta, youtube, tiktok } = touchpoints;

    const orderedObj = {
      youtubeTargetGroup: youtube || [],
      metaTargetGroup: meta || [],
      tiktokTargetGroup: tiktok || [],
    };

    // * old code
    // const arrayTouchpoints = Object.entries(orderedObj).filter(([_key, value]) => value.length > 0);
    const arrayTouchpoints = Object.entries(orderedObj).filter(
      ([_key, value]) => value !== null && value.length > 0,
    );

    const resultTouchpoints = arrayTouchpoints.length === 0 ? null : arrayTouchpoints;

    if (resultTouchpoints && resultTouchpoints.length) {
      const maxLength = resultTouchpoints[0][1].length;

      const touchpointsArray = Array.from({ length: maxLength }, (_, index) => {
        const currentObject = resultTouchpoints.reduce((acc, [key, values]) => {
          if (index < values.length) {
            const value = values[index];
            if (value) {
              acc[key] = value;
            }
          }
          return acc;
        }, {});

        return { ...currentObject, ...request };
      });
      result.push(...touchpointsArray);
    } else {
      result.push(request);
    }
  }
  return result;
};

module.exports = {
  getPossibleTouchPoints,
};
