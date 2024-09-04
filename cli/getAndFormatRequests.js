const fs = require('fs');
const mongo = require('../src/database/index');

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

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

  console.log(result.length);
  console.log(result[0]);

  fs.writeFileSync(`${__dirname}/results/full-requests.json`, JSON.stringify(result));

  await mongo.closeConnection();
})();
