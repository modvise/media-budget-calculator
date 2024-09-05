const fs = require('fs');
const mongo = require('../src/database/index');

const { formatDate } = require('../src/utils/formatDate');

(async () => {
  await mongo.connectToDatabase();
  const requestsCollection = mongo.getCollection('requests');
  const requests = await requestsCollection.find({}).toArray();

  const result = requests.map((request, ind) => {
    const [year, month, day] = request.campaignStartDate.split('-');
    const formattedStartDate = `${day}/${month}/${year}`;

    const formattedEndDate = formatDate(request.campaignEndDate);
    return {
      ...request,
      campaignStartDate: formattedStartDate,
      campaignEndDate: formattedEndDate,
    };
  });

  fs.writeFileSync(`${__dirname}/results/full-requests.json`, JSON.stringify(result));

  await mongo.closeConnection();
})();
