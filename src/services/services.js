const _ = require('lodash');
const { DateTime } = require('luxon');
const mongo = require('../database/index');

const DefaultParams = {
  DEFAULT_CAMPAIGN_DURATION: 6,
};

const emptyAdditionalData = {
  budget: null,
  impressions: null,
  reach: null,
  clicks: null,
  videoViews: null,
  techCost: null,
};

const calculateYTBudget = (
  config,
  targetGroups,
  campaign,
  touchpointsRates,
  techCostsIndexes,
  filters,
) => {
  const youtubeViewsShareBumper = filters.campaignBumper || 0.4;
  const youtubeViewsShareSkipUnskip = (1 - youtubeViewsShareBumper) / 2;
  const campaignTargetGroup = getCampaignTargetGroup(campaign, filters);
  const targetGroup = findTargetGroupByTouchpoint(
    campaign.touchpointName,
    campaignTargetGroup,
    targetGroups,
    campaign.countryIso,
  );
  if (
    !targetGroup ||
    !targetGroup.targetSizeAdPanel ||
    !targetGroup.targetGroupSizePopulation ||
    !campaign.tgSaturationCalc
  ) {
    console.error('Missing required data');
    return emptyAdditionalData;
  }
  const campaignTargetSize = getTargetGroupSize(config, targetGroup);
  const campaignReach = campaign.tgSaturationCalc * campaignTargetSize;

  const campaignFrequency = getCampaignFrequency(config, campaign, filters);
  const campaignVideoViews = campaignReach * campaignFrequency;

  const touchpointClickRate = getTouchpointClickRate(config, campaign);
  const campaignClicks = campaignVideoViews * touchpointClickRate;

  const campaignData = {
    budget: null,
    impressions: null,
    reach: roundNumber(campaignReach, 10),
    clicks: roundNumber(campaignClicks, 10),
    videoViews: roundNumber(campaignVideoViews, 10),
    techCost: null,
  };

  const campaignRateObj = findRateFromArr(campaign, touchpointsRates, filters);
  if (campaignRateObj) {
    const touchpointVideoRate = getTouchpointYTVideoRate(config, campaign);
    const techCostIndex = getTechCostIndexFromArr(
      techCostsIndexes,
      campaign.touchpointName,
      campaign.touchpointFunnel,
    );

    const touchpointVideoRateBumper = Number(touchpointVideoRate['vtr_youtube_bumper']);
    const touchpointVideoRateSkip = Number(touchpointVideoRate['vtr_youtube_skip']);
    const touchpointVideoRateUnskip = Number(touchpointVideoRate['vtr_youtube_unskip']);

    const campaignRatePriceBumper =
      Number(campaignRateObj.cpmRateYTBumper) / touchpointVideoRateBumper / 1000;
    const campaignRatePriceSkip =
      Number(campaignRateObj.cpmRateYTSkip) / touchpointVideoRateSkip / 1000;
    const campaignRatePriceUnskip =
      Number(campaignRateObj.cpmRateYTUnskip) / touchpointVideoRateUnskip / 1000;

    const campaignRatePriceBumperFull = Number(campaignRateObj.cpmRateYTBumper) / 1000;
    const campaignRatePriceSkipFull = Number(campaignRateObj.cpmRateYTSkip) / 1000;
    const campaignRatePriceUnskipFull = Number(campaignRateObj.cpmRateYTUnskip) / 1000;

    const campaignRateViewsShareBumperFull = youtubeViewsShareBumper / campaignRatePriceBumperFull;
    const campaignRateViewsShareSkipFull = youtubeViewsShareSkipUnskip / campaignRatePriceSkipFull;
    const campaignRateViewsShareUnskipFull =
      youtubeViewsShareSkipUnskip / campaignRatePriceUnskipFull;
    const campaignRateViewsShareFullSum =
      campaignRateViewsShareBumperFull +
      campaignRateViewsShareSkipFull +
      campaignRateViewsShareUnskipFull;

    const campaignRateViewsShareBumper = youtubeViewsShareBumper / campaignRatePriceBumper;
    const campaignRateViewsShareSkip = youtubeViewsShareSkipUnskip / campaignRatePriceSkip;
    const campaignRateViewsShareUnskip = youtubeViewsShareSkipUnskip / campaignRatePriceUnskip;
    const campaignRateViewsShareSum =
      campaignRateViewsShareBumper + campaignRateViewsShareSkip + campaignRateViewsShareUnskip;
    const campaignBudget = campaignVideoViews / campaignRateViewsShareSum;
    const campaignImpressions = campaignBudget * campaignRateViewsShareFullSum;
    campaignData.budget = roundNumber(campaignBudget, 10);
    campaignData.impressions = roundNumber(campaignImpressions, 10);
    campaignData.techCost = roundNumber(
      campaignBudget * (techCostIndex.techCostAdServer + techCostIndex.techCostDspFee),
      10,
    );
  }

  return campaignData;
};

const getTouchpointClickRate = (config, campaign) => {
  switch (campaign.touchpointName) {
    default:
    case 'META':
      return config['ctr_meta_rf'];
    case 'TIKTOK':
      return config['ctr_tiktok_rf'];
    case 'YOUTUBE':
      return config['ctr_yt'];
  }
};

const getTouchpointTargetGroup = (touchpointName, filters) => {
  switch (touchpointName) {
    case 'TIKTOK':
      return filters.tiktokTargetGroup;
    case 'META':
      return filters.metaTargetGroup;
    case 'YOUTUBE':
      return filters.youtubeTargetGroup;
    default:
      return filters.metaTargetGroup;
  }
};

const getTouchpointRate = (campaign, touchpointsRates) => {
  switch (campaign.touchpointName) {
    default:
    case 'META':
      return touchpointsRates.meta;
    case 'TIKTOK':
      return touchpointsRates.tiktok;
    case 'YOUTUBE':
      return touchpointsRates.youtube;
  }
};

const findRateFromArr = (campaign, touchpointsRates, filters) => {
  const rates = getTouchpointRate(campaign, touchpointsRates);
  const touchpointTargetGroup = getTouchpointTargetGroup(campaign.touchpointName, filters);
  const filteredRate = rates.find(
    (rate) =>
      rate.division === campaign.division &&
      rate.campaignType === campaign.campaignType &&
      rate.targetGroupName === touchpointTargetGroup,
  );
  if (!filteredRate) {
    console.error(
      `Error find rate for: ${campaign.division} ${campaign.campaignType} ${
        touchpointTargetGroup || ''
      } ${campaign.touchpointName}`,
    );
  }
  return filteredRate;
};

const getCampaignFrequency = (config, campaign, filters) => {
  const metaCampaignDuration = filters.campaignDuration || DefaultParams.DEFAULT_CAMPAIGN_DURATION;
  switch (campaign.touchpointName) {
    default:
    case 'META':
    case 'TIKTOK':
      if (metaCampaignDuration <= 3) return 4.2;
      return metaCampaignDuration + 0.5;
    case 'YOUTUBE':
      return config['frequency_views_yt'];
  }
};

const getMetaReach = (config, campaign, targetGroup, campaignTargetSize) => {
  const { targetSizeAdPanel } = targetGroup;
  const campaignReach = campaign.tgSaturationCalc * campaignTargetSize;
  const minReach = Number(config['min_reach']) * targetSizeAdPanel;
  const maxReach = Number(config['max_reach']) * targetSizeAdPanel;
  if (campaignReach > maxReach) {
    return maxReach;
  }
  if (campaign.touchpointName === 'TIKTOK' && campaignReach < minReach) {
    return minReach;
  }
  return campaignReach;
};

const getCampaignTargetGroup = (campaign, filters) => {
  switch (campaign.touchpointName) {
    default:
    case 'META':
      return filters.metaTargetGroup;
    case 'TIKTOK':
      return filters.tiktokTargetGroup;
    case 'YOUTUBE':
      return filters.youtubeTargetGroup;
  }
};

const getTouchpointMetaVideoRate = (config, campaign) => {
  switch (campaign.touchpointName) {
    default:
    case 'META':
      return config['vtr_meta_rf'];
    case 'TIKTOK':
      return config['vtr_tiktok_rf'];
  }
};

const calculateMetaBudget = (
  config,
  targetGroups,
  campaign,
  touchpointsRates,
  techCostsIndexes,
  filters,
) => {
  const campaignTargetGroup = getCampaignTargetGroup(campaign, filters);
  const targetGroup = findTargetGroupByTouchpoint(
    campaign.touchpointName,
    campaignTargetGroup,
    targetGroups,
    campaign.countryIso,
  );
  if (
    !targetGroup ||
    !targetGroup.targetSizeAdPanel ||
    !targetGroup.targetGroupSizePopulation ||
    !campaign.tgSaturationCalc
  ) {
    console.error('Meta budget calculations: Missing required data');
    return emptyAdditionalData;
  }
  const campaignTargetSize = getTargetGroupSize(config, targetGroup);
  const campaignReach = getMetaReach(config, campaign, targetGroup, campaignTargetSize);
  const campaignFrequency = getCampaignFrequency(config, campaign, filters);
  const campaignImpressions = campaignReach * campaignFrequency;
  const campaignData = {
    budget: null,
    impressions: roundNumber(campaignImpressions, 10),
    reach: roundNumber(campaignReach, 10),
    clicks: null,
    videoViews: null,
    techCost: null,
  };

  const campaignRateObj = findRateFromArr(campaign, touchpointsRates, filters);
  if (campaignRateObj) {
    const campaignRate = Number(campaignRateObj.cpmRate);
    const techCostIndex = getTechCostIndexFromArr(
      techCostsIndexes,
      campaign.touchpointName,
      campaign.touchpointFunnel,
    );

    const campaignBudget = (campaignImpressions * campaignRate) / 1000;
    campaignData.budget = roundNumber(campaignBudget, 10);
    campaignData.techCost = roundNumber(
      campaignBudget * (techCostIndex.techCostAdServer + techCostIndex.techCostDspFee),
      10,
    );
  }

  const touchpointClickRate = getTouchpointClickRate(config, campaign);
  if (touchpointClickRate) {
    const campaignClicks = campaignImpressions * touchpointClickRate;
    campaignData.clicks = roundNumber(campaignClicks, 10);
  }

  const touchpointVideoRate = getTouchpointMetaVideoRate(config, campaign);
  if (touchpointVideoRate) {
    const campaignVideoViews = campaignImpressions * touchpointVideoRate;
    campaignData.videoViews = roundNumber(campaignVideoViews, 10);
  }

  return campaignData;
};

const getCalculateData = (
  config,
  targetGroups,
  campaign,
  touchpointsRates,
  techCostsIndexes,
  filters,
) => {
  const { touchpointFunnel, touchpointName } = campaign;
  if (touchpointFunnel === 'RF' && ['TIKTOK', 'META'].includes(touchpointName)) {
    return calculateMetaBudget(
      config,
      targetGroups,
      campaign,
      touchpointsRates,
      techCostsIndexes,
      filters,
    );
  }
  if (touchpointName === 'YOUTUBE') {
    return calculateYTBudget(
      config,
      targetGroups,
      campaign,
      touchpointsRates,
      techCostsIndexes,
      filters,
    );
  }
  return emptyAdditionalData;
};

const roundNumber = (value, precision) => {
  const roundedValue = Math.round(value / precision);
  return roundedValue * precision;
};

const getTechCostIndexFromArr = (techCosts, touchpointName, touchpointFunnel) => {
  const techCost = techCosts.find(
    (tCost) =>
      tCost.touchpointName === touchpointName && tCost.touchpointFunnel === touchpointFunnel,
  );
  if (!techCost) {
    return {
      touchpointName,
      touchpointFunnel,
      techCostDspFee: 0,
      techCostAdServer: 0,
    };
  }
  return techCost;
};

const getFixedData = (config, targetGroups, campaign, techCostsIndexes, metaTargetGroup) => {
  const targetGroup = findTargetGroupByTouchpoint(
    'META',
    metaTargetGroup,
    targetGroups,
    campaign.countryIso,
  );

  if (!targetGroup) {
    console.error('Wrong target group for fixed budget campaign');
    return emptyAdditionalData;
  }
  const targetGroupPopulation = targetGroup.targetGroupSizePopulation;
  const techCostIndex = getTechCostIndexFromArr(
    techCostsIndexes,
    campaign.touchpointName,
    campaign.touchpointFunnel,
  );
  if (targetGroupPopulation > config['fixed_tg_size_top']) {
    const budgetValue = campaign.fixedTouchpointMaxBud
      ? roundNumber(campaign.fixedTouchpointMaxBud, 10)
      : null;
    return {
      budget: budgetValue,
      impressions: campaign.fixedTouchpointMaxImpressions
        ? roundNumber(campaign.fixedTouchpointMaxImpressions, 10)
        : null,
      reach: campaign.fixedTouchpointMaxReach
        ? roundNumber(campaign.fixedTouchpointMaxReach, 10)
        : null,
      clicks: campaign.fixedTouchpointMaxClicks
        ? roundNumber(campaign.fixedTouchpointMaxClicks, 10)
        : null,
      videoViews: campaign.fixedTouchpointMaxViews
        ? roundNumber(campaign.fixedTouchpointMaxViews, 10)
        : null,
      techCost: budgetValue
        ? roundNumber(
            budgetValue * (techCostIndex.techCostAdServer + techCostIndex.techCostDspFee),
            10,
          )
        : null,
    };
  }
  if (targetGroupPopulation < config['fixed_tg_size_bottom']) {
    const budgetValue = campaign.fixedTouchpointMinBud
      ? roundNumber(campaign.fixedTouchpointMinBud, 10)
      : null;
    return {
      budget: budgetValue,
      impressions: campaign.fixedTouchpointMinImpressions
        ? roundNumber(campaign.fixedTouchpointMinImpressions, 10)
        : null,
      reach: campaign.fixedTouchpointMinReach
        ? roundNumber(campaign.fixedTouchpointMinReach, 10)
        : null,
      clicks: campaign.fixedTouchpointMinClicks
        ? roundNumber(campaign.fixedTouchpointMinClicks, 10)
        : null,
      videoViews: campaign.fixedTouchpointMinViews
        ? roundNumber(campaign.fixedTouchpointMinViews, 10)
        : null,
      techCost: budgetValue
        ? roundNumber(
            budgetValue * (techCostIndex.techCostAdServer + techCostIndex.techCostDspFee),
            10,
          )
        : null,
    };
  }
  const budgetValue = campaign.fixedTouchpointMediumBud
    ? roundNumber(campaign.fixedTouchpointMediumBud, 10)
    : null;
  return {
    budget: budgetValue,
    impressions: campaign.fixedTouchpointMediumImpressions
      ? roundNumber(campaign.fixedTouchpointMediumImpressions, 10)
      : null,
    reach: campaign.fixedTouchpointMediumReach
      ? roundNumber(campaign.fixedTouchpointMediumReach, 10)
      : null,
    clicks: campaign.fixedTouchpointMediumClicks
      ? roundNumber(campaign.fixedTouchpointMediumClicks, 10)
      : null,
    videoViews: campaign.fixedTouchpointMediumViews
      ? roundNumber(campaign.fixedTouchpointMediumViews, 10)
      : null,
    techCost: budgetValue
      ? roundNumber(
          budgetValue * (techCostIndex.techCostAdServer + techCostIndex.techCostDspFee),
          10,
        )
      : null,
  };
};

const calculateAdditionalCampaignData = (
  config,
  targetGroups,
  budget,
  touchpointsRates,
  techCostsIndexes,
  filters,
) => {
  const { metaTargetGroup } = filters;
  if (budget.isFixed) {
    return getFixedData(config, targetGroups, budget, techCostsIndexes, metaTargetGroup);
  }
  return getCalculateData(
    config,
    targetGroups,
    budget,
    touchpointsRates,
    techCostsIndexes,
    filters,
  );
};

const getTgSizeSource = (config, targetGroup) => {
  if (!targetGroup) return null;
  const selectedTargetSize = getTargetGroupSize(config, targetGroup);
  if (selectedTargetSize === targetGroup.targetGroupSizePopulation) return 'Population';
  if (selectedTargetSize === targetGroup.targetSizeAdPanel) return 'Panel';
  return null;
};

const getProgrammaticReachIndex = (config, countryIso) =>
  Number(config[`${countryIso.toLowerCase()}_w18p_yt`]);

const getTargetGroupSize = (config, targetGroup) => {
  const { targetSizeAdPanel, targetGroupSizePopulation, touchpointName } = targetGroup;
  if (touchpointName === 'YOUTUBE') return targetGroupSizePopulation;
  if (targetSizeAdPanel >= config['tg_size_compare_index'] * targetGroupSizePopulation) {
    return targetSizeAdPanel;
  }
  return targetGroupSizePopulation;
};

const getGemiusTgSize = (metaTargetGroup, tiktokTargetGroup, ytTargetGroup) => ({
  id: 1,
  youtube: ytTargetGroup && ytTargetGroup.targetGroupSizePopulation,
  meta: metaTargetGroup && metaTargetGroup.targetGroupSizePopulation,
  tiktok: tiktokTargetGroup && tiktokTargetGroup.targetGroupSizePopulation,
});

const getPanelTgSize = (metaTargetGroup, tiktokTargetGroup) => ({
  id: 2,
  youtube: null,
  meta: metaTargetGroup && metaTargetGroup.targetSizeAdPanel,
  tiktok: tiktokTargetGroup && tiktokTargetGroup.targetSizeAdPanel,
});

const getTgSizeSourceList = (config, metaTargetGroup, tiktokTargetGroup, ytTargetGroup) => ({
  id: 3,
  youtube: getTgSizeSource(config, ytTargetGroup),
  meta: getTgSizeSource(config, metaTargetGroup),
  tiktok: getTgSizeSource(config, tiktokTargetGroup),
});

const getYtReachIndexMatch = (config, ytTargetGroup, ytReachIndex, ytCampaign, countryIso) => {
  const matchIndexObj = {
    id: 5,
    youtube: false,
    meta: null,
    tiktok: null,
  };
  if (!ytCampaign) {
    matchIndexObj.youtube = null;
    return matchIndexObj;
  }
  if (
    !ytTargetGroup ||
    !ytReachIndex ||
    !ytReachIndex.programmaticReachIndex ||
    !ytCampaign.tgSaturationCalc
  )
    return matchIndexObj;
  const { programmaticReachIndex } = ytReachIndex;
  const campaignTargetSize = getTargetGroupSize(config, ytTargetGroup);
  let campaignReach = ytCampaign.tgSaturationCalc * campaignTargetSize;
  if (ytTargetGroup.targetGroupName.startsWith('m-w')) {
    campaignReach /= 2;
  }
  const tgProgrammaticReachIndex = getProgrammaticReachIndex(config, countryIso);
  console.log(
    'getYtReachIndexMatch',
    campaignReach / tgProgrammaticReachIndex,
    Number(programmaticReachIndex),
  );
  matchIndexObj.youtube =
    campaignReach / tgProgrammaticReachIndex >= Number(programmaticReachIndex);
  return matchIndexObj;
};

const getMetaMinimumReachMatch = (
  config,
  metaTargetGroupObj,
  metaCampaign,
  filters,
  countryIso,
) => {
  const matchIndexObj = {
    id: 6,
    youtube: null,
    meta: false,
    tiktok: null,
  };
  if (countryIso !== 'PL' || !filters.divisionName.startsWith('CPD')) {
    matchIndexObj.meta = null;
    return matchIndexObj;
  }
  if (!metaCampaign || !metaTargetGroupObj || !metaCampaign.tgSaturationCalc) return matchIndexObj;

  const campaignTargetSize = getTargetGroupSize(config, metaTargetGroupObj);
  const campaignReach = metaCampaign.tgSaturationCalc * campaignTargetSize;
  matchIndexObj.meta = campaignReach >= Number(config['cpd_meta_min_reach']);
  return matchIndexObj;
};

const getYtProgrammaticIndex = (config, countryIso) => {
  const tgProgrammaticReachIndex = getProgrammaticReachIndex(config, countryIso);
  return {
    id: 4,
    youtube: tgProgrammaticReachIndex,
    meta: null,
    tiktok: null,
  };
};

const getProgrammaticIndexByDivision = async (countryIso, division) => {
  const reachIndexCollection = mongo.getCollection('programmatic-reach-index-yt');
  const query = {
    countryIso,
    division,
  };
  const options = {
    projection: { _id: 0, countryIso: 1, division: 1, programmaticReachIndex: 1 },
  };
  return await reachIndexCollection.findOne(query, options);
};

const findTargetGroupByTouchpoint = (touchpointName, targetGroupName, targetGroups, countryIso) => {
  if (!targetGroupName) return null;
  return targetGroups.find(
    (group) =>
      group.targetGroupName === targetGroupName &&
      group.touchpointName === touchpointName &&
      group.countryIso === countryIso,
  );
};

const parseDate = (dateString, campaignDuration) => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw Error('Wrong data format');
  }
  const dtDate = DateTime.fromJSDate(date);
  const endDate = dtDate.plus({ weeks: campaignDuration - 1 });

  const weekNumber = dtDate.get('weekNumber');
  const endWeekNumber = endDate.get('weekNumber');
  const monthNumber = dtDate.get('month');
  const endMonthNumber = endDate.get('month');
  const yearNumber = dtDate.get('year');
  const endYearNumber = endDate.get('year');

  return {
    weekNumber,
    endWeekNumber,
    monthNumber,
    endMonthNumber,
    yearNumber,
    endYearNumber,
  };
};

const generateAggregationFilter = (dateAttributes) => {
  const { weekNumber, endWeekNumber, monthNumber, endMonthNumber, yearNumber, endYearNumber } =
    dateAttributes;
  if (yearNumber === endYearNumber) {
    return {
      yearNumber: { $eq: yearNumber },
      $and: [
        {
          weekNumber: { $gte: weekNumber },
          monthNumber: { $gte: monthNumber },
        },
        {
          weekNumber: { $lte: endWeekNumber },
          monthNumber: { $lte: endMonthNumber },
        },
      ],
    };
  }
  const filterConditions = [];
  for (let year = yearNumber; year <= endYearNumber; year += 1) {
    if (year === yearNumber) {
      filterConditions.push({
        $and: [
          {
            weekNumber: { $gte: weekNumber },
            monthNumber: { $gte: monthNumber },
            yearNumber: { $eq: yearNumber },
          },
          {
            weekNumber: { $lte: 53 },
            monthNumber: { $lte: 12 },
            yearNumber: { $eq: yearNumber },
          },
        ],
      });
    } else if (year === endYearNumber) {
      filterConditions.push({
        $and: [
          {
            weekNumber: { $gte: 1 },
            monthNumber: { $gte: 1 },
            yearNumber: { $eq: endYearNumber },
          },
          {
            weekNumber: { $lte: endWeekNumber },
            monthNumber: { $lte: endMonthNumber },
            yearNumber: { $eq: endYearNumber },
          },
        ],
      });
    } else {
      filterConditions.push({
        yearNumber: { $eq: year },
      });
    }
  }
  return {
    $or: filterConditions,
  };
};

const getRatesTableName = (touchpointName) => {
  switch (touchpointName) {
    default:
    case 'META':
      return 'rates-meta';
    case 'TIKTOK':
      return 'rates-tik-tok';
    case 'YOUTUBE':
      return 'rates-yt';
  }
};

const getAverageRates = async (countryIso, filters, touchpointName) => {
  const { DEFAULT_CAMPAIGN_DURATION } = DefaultParams;
  const { campaignStartDate, campaignDuration = DEFAULT_CAMPAIGN_DURATION } = filters;
  const tableName = getRatesTableName(touchpointName);
  const ratesCollection = mongo.getCollection(tableName);
  const parsedData = parseDate(campaignStartDate, campaignDuration || DEFAULT_CAMPAIGN_DURATION);
  const { weekNumber, monthNumber, endWeekNumber, endMonthNumber, yearNumber, endYearNumber } =
    parsedData;
  console.log(
    `Rates date: week ${weekNumber}, month ${monthNumber}, year ${yearNumber},
      endWeek ${endWeekNumber}, endMonth ${endMonthNumber}, endYear ${endYearNumber}`,
  );

  let options = {};
  if (touchpointName === 'YOUTUBE') {
    options = {
      cpmRateYTSkip: { $avg: '$cpmRateYTSkip' },
      cpmRateYTBumper: { $avg: '$cpmRateYTBumper' },
      cpmRateYTUnskip: { $avg: '$cpmRateYTUnskip' },
    };
  } else {
    options = {
      cpmRate: { $avg: '$cpmRate' },
    };
  }

  const pipelineFilter = generateAggregationFilter(parsedData);

  const pipeline = [
    {
      $match: {
        countryIso,
        ...pipelineFilter,
      },
    },
    {
      $group: {
        _id: {
          division: '$division',
          campaignType: '$campaignType',
          targetGroupName: '$targetGroupName',
        },
        ...options,
      },
    },
  ];
  const averageRates = await ratesCollection.aggregate(pipeline).toArray();
  const result = averageRates.map((averageData) => {
    const { _id: idData, ...restOfDta } = averageData;
    return {
      ...idData,
      ...restOfDta,
    };
  });

  return result;
};

const getEstimatedBudgets = (
  config,
  targetGroups,
  budgets,
  touchpointsRates,
  techCostsIndexes,
  filters,
) =>
  budgets.map((budget) => {
    const additionalData = calculateAdditionalCampaignData(
      config,
      targetGroups,
      budget,
      touchpointsRates,
      techCostsIndexes,
      filters,
    );
    return {
      id: budget._id.toString(),
      touchpointName: budget.touchpointName,
      touchpointFunnel: budget.touchpointFunnel,
      isMustHave: !!budget.isMustHave,
      ...additionalData,
    };
  });

const getCampaignParameters = async (regionIso, config, targetGroups, budgets, filters) => {
  const { metaTargetGroup, tiktokTargetGroup, youtubeTargetGroup } = filters;

  const metaTargetGroupObj = findTargetGroupByTouchpoint(
    'META',
    metaTargetGroup,
    targetGroups,
    regionIso,
  );
  const tiktokTargetGroupObj = findTargetGroupByTouchpoint(
    'TIKTOK',
    tiktokTargetGroup,
    targetGroups,
    regionIso,
  );
  const ytTargetGroupObj = findTargetGroupByTouchpoint(
    'YOUTUBE',
    youtubeTargetGroup,
    targetGroups,
    regionIso,
  );

  const ytReachIndex = await getProgrammaticIndexByDivision(regionIso, filters.divisionName);
  const ytCampaignDefinition = budgets.find(
    (budget) =>
      budget.countryIso === regionIso &&
      budget.division === filters.divisionName &&
      budget.campaignType === filters.campaignTypeName &&
      budget.touchpointName === 'YOUTUBE',
  );

  const metaCampaignDefinition = budgets.find(
    (budget) =>
      budget.countryIso === regionIso &&
      budget.division === filters.divisionName &&
      budget.campaignType === filters.campaignTypeName &&
      budget.touchpointFunnel === 'RF' &&
      budget.touchpointName === 'META',
  );

  return [
    getGemiusTgSize(metaTargetGroupObj, tiktokTargetGroupObj, ytTargetGroupObj),
    getPanelTgSize(metaTargetGroupObj, tiktokTargetGroupObj),
    getTgSizeSourceList(config, metaTargetGroupObj, tiktokTargetGroupObj, ytTargetGroupObj),
    getYtProgrammaticIndex(config, regionIso),
    getYtReachIndexMatch(config, ytTargetGroupObj, ytReachIndex, ytCampaignDefinition, regionIso),
    getMetaMinimumReachMatch(
      config,
      metaTargetGroupObj,
      metaCampaignDefinition,
      filters,
      regionIso,
    ),
  ];
};

const getAllTouchpointsRates = async (countryIso, filters) => {
  const metaRates = await getAverageRates(countryIso, filters, 'META');
  const tiktokRates = await getAverageRates(countryIso, filters, 'TIKTOK');
  const ytRates = await getAverageRates(countryIso, filters, 'YOUTUBE');
  return {
    meta: metaRates,
    tiktok: tiktokRates,
    youtube: ytRates,
  };
};

const getTechCostIndexes = async () => {
  const techCostsCollection = mongo.getCollection('tech-costs');

  const options = {
    projection: {
      _id: 0,
      touchpointName: 1,
      touchpointFunnel: 1,
      techCostDspFee: 1,
      techCostAdServer: 1,
    },
  };

  const techCosts = await techCostsCollection.find({}, options).toArray();
  return techCosts;
};

const getTargetGroups = async () => {
  const tgCollection = mongo.getCollection('target-groups');

  const options = {
    projection: {
      _id: 0,
      countryIso: 1,
      touchpointName: 1,
      targetGroupName: 1,
      targetGroupSizePopulation: 1,
      targetSizeAdPanel: 1,
    },
  };

  const targetGroups = await tgCollection.find({}, options).toArray();
  return targetGroups;
};

const getConfig = async () => {
  const configCollection = mongo.getCollection('configuration-sheet');
  const options = {
    projection: { _id: 0, value: 1, name: 1 },
  };
  const configArr = await configCollection.find({}, options).toArray();
  const configObj = {};
  configArr.forEach((config) => (configObj[config.name] = config.value));
  return configObj;
};

const getCampaignAttributesData = async (countryIso, division, campaignType) => {
  const campaignAttributesCollection = mongo.getCollection('campaign-attributes');
  const campaignAttributes = await campaignAttributesCollection.findOne(
    { countryIso, division, campaignType },
    { projection: { _id: 0, countryIso: 0, division: 0, campaignType: 0 } },
  );
  if (!campaignAttributes) {
    throw Error('Missing data for division/campaign pair');
  }
  return {
    campaignDurationMin: campaignAttributes.minWeeks,
    campaignDurationMax: campaignAttributes.maxWeeks,
    bumperRecommended: campaignAttributes.ytBumperShareReco,
    bumperMin: campaignAttributes.ytBumperShareMin,
    bumperMax: campaignAttributes.ytBumperShareMax,
  };
};

const getCampaignTypesByRegion = async (regionIso, divisionName) => {
  const campaignsCollection = mongo.getCollection('campaigns-definition');
  const query = {
    countryIso: regionIso,
    division: divisionName,
    isMustHave: { $ne: null },
    isFixed: { $ne: null },
  };

  const campaignTypes = await campaignsCollection.distinct('campaignType', query);
  return campaignTypes.map((campaignType) => campaignType);
};

const getTouchpointsByRegion = async (regionIso, campaignType, divisionName) => {
  const touchpointNames = await getDivisionTouchpointNames(regionIso, divisionName, campaignType);

  const tgCollection = mongo.getCollection('target-groups');
  const query = {
    countryIso: regionIso,
  };
  const options = {
    projection: { _id: 0, touchpointName: 1, targetGroupName: 1 },
  };

  const touchpoints = await tgCollection.find(query, options).toArray();

  const touchpointsGrouped = _.groupBy(touchpoints, 'touchpointName');

  const touchpointsGroupedObj = {};

  Object.keys(touchpointsGrouped).forEach((key) => {
    const touchpointGroup = touchpointsGrouped[key];
    touchpointsGroupedObj[key.toLowerCase()] = touchpointNames.includes(key)
      ? touchpointGroup.map((touchpoint) => touchpoint.targetGroupName).sort()
      : null;
  });
  return touchpointsGroupedObj;
};

const getDivisionTouchpointNames = async (regionIso, divisionName, campaignType) => {
  const campaignsCollection = mongo.getCollection('campaigns-definition');
  const query = {
    countryIso: regionIso,
    division: divisionName,
    campaignType,
    isMustHave: { $ne: null },
  };
  return campaignsCollection.distinct('touchpointName', query);
};

const getEstimatedBudgetsTotal = async (regionIso, filters) => {
  const { divisionName, campaignTypeName } = filters;
  const campaignsCollection = mongo.getCollection('campaigns-definition');
  const query = {
    countryIso: regionIso,
    division: divisionName,
    campaignType: campaignTypeName,
    isMustHave: { $ne: null },
    isFixed: { $ne: null },
  };
  const options = {
    projection: {
      _id: 1,
      countryIso: 1,
      touchpointName: 1,
      campaignType: 1,
      division: 1,
      touchpointFunnel: 1,
      isMustHave: 1,
      isFixed: 1,
      tgSaturationCalc: 1,
      fixedTouchpointMinBud: 1,
      fixedTouchpointMediumBud: 1,
      fixedTouchpointMaxBud: 1,
      fixedTouchpointMinImpressions: 1,
      fixedTouchpointMinReach: 1,
      fixedTouchpointMinClicks: 1,
      fixedTouchpointMinViews: 1,
      fixedTouchpointMediumImpressions: 1,
      fixedTouchpointMediumReach: 1,
      fixedTouchpointMediumClicks: 1,
      fixedTouchpointMediumViews: 1,
      fixedTouchpointMaxImpressions: 1,
      fixedTouchpointMaxReach: 1,
      fixedTouchpointMaxClicks: 1,
      fixedTouchpointMaxViews: 1,
    },
  };
  const budgets = await campaignsCollection.find(query, options).toArray();
  const config = await getConfig();
  const targetGroups = await getTargetGroups();
  const techCostsIndexes = await getTechCostIndexes();
  const touchpointsRates = await getAllTouchpointsRates(regionIso, filters);
  const parametersCampaign = await getCampaignParameters(
    regionIso,
    config,
    targetGroups,
    budgets,
    filters,
  );

  return {
    estimatedBudgets: getEstimatedBudgets(
      config,
      targetGroups,
      budgets,
      touchpointsRates,
      techCostsIndexes,
      filters,
    ),
    parametersCampaign,
  };
};
module.exports = {
  getCampaignAttributesData,
  getCampaignTypesByRegion,
  getTouchpointsByRegion,
  getEstimatedBudgetsTotal,
  getDivisionTouchpointNames,
};
