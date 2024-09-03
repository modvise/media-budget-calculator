const possibleCompDates = (compAttrs, dates) => {
  const result = [];
  for (const compAttr of compAttrs) {
    const { campaignDuration } = compAttr;
    for (const startDate of dates) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + campaignDuration * 7);
      const resultObj = {
        ...compAttr,
        campaignStartDate: startDate,
        campaignEndDate: date.toISOString(),
      };
      result.push(resultObj);
    }
  }
  return result;
};

module.exports = {
  possibleCompDates,
};
