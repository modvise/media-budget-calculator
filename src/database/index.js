const { MongoClient } = require('mongodb');
const config = require('../config/environment.config');

let db;
let client;

const getMongoClient = async () => {
  if (!client) {
    client = new MongoClient(config['DB_CONN_STRING']);

    await client.connect();
    console.log('MongoDB connected successfully');
  }

  return client;
};

const connectToDatabase = async () => {
  await getMongoClient();

  db = client?.db(config['DB_NAME']);
};

const connectToLogDatabase = async () => {
  await getMongoClient();

  return client?.db(config['DB_LOG_NAME']);
};

const closeConnection = async () => {
  if (client) {
    await client.close();
    console.log('Connection has been closed successfully');
  }
  client = undefined;
};

const getDbCollection = (database, collectionName) => {
  if (!collectionName) {
    throw new Error('Missing collection name');
  }

  const collection = database.collection(collectionName);
  console.log(
    `Successfully connected to database: ${database.databaseName} and collection: ${collection.collectionName}`,
  );

  return collection;
};
const getCollection = (collectionName) => getDbCollection(db, collectionName);

module.exports = {
  db,
  getCollection,
  connectToDatabase,
  closeConnection,
  connectToLogDatabase,
  getDbCollection,
};
