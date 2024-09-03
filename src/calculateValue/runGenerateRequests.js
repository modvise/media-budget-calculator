const { v4: uuidv4 } = require('uuid');
const mongo = require('../database/index');

const { getMondays } = require('./getPossibleData/getAllMondays');
const { possibleCompDates } = require('./getPossibleData/getPossibleDates');
const { getPossibleTouchPoints } = require('./getPossibleData/getPossibleTouchPoints');
const { getPossibleCompTypes } = require('./getPossibleData/getPossibleCompTypes');
const { getPossibleCompAttr } = require('./getPossibleData/getPossibleCompAttr');

// import { getDivionsByRegion } from '../../services/campaign.service';

// TODO: save output to DB

const REGION_ISO = 'PL';

const generateRequests = async (run) => {
  if (run) {
    await mongo.connectToDatabase();
    // const divisions = await getDivisionsByRegion(REGION_ISO);
    const divisions = [
      'CPD_HAIR CARE',
      // 'CPD_HAIR COLOR',
      // 'CPD_MAKE UP',
      // 'CPD_SKIN CARE',
      // 'LDB',
      // 'LPD',
      // 'PPD',
    ];
    const possibleCompTypes = await getPossibleCompTypes(REGION_ISO, divisions);
    const possibleCompAttr = await getPossibleCompAttr(REGION_ISO, possibleCompTypes);
    const mondays = getMondays();
    const possibleDates = possibleCompDates(possibleCompAttr, mondays);
    const possibleVariants = await getPossibleTouchPoints(REGION_ISO, possibleDates);
    const result = possibleVariants.map((variant) => ({
      id: uuidv4(),
      ...variant,
      touchpoints: ['youtube', 'meta', 'tiktok'],
    }));
    const resultRequest = mongo.getCollection('requests');
    await resultRequest.insertMany(result);
    await mongo.closeConnection();
  }
};

generateRequests(true).then(console.log).catch(console.error);
