/**
 * Use a singleton CosmosDB client across functions.
 */
import { CosmosClient } from "@azure/cosmos";

import { getConfigOrThrow } from "./config";

const config = getConfigOrThrow();

// Setup DocumentDB
const cosmosDbUri = config.COSMOSDB_URI;
export const cosmosDbName = config.COSMOSDB_NAME;
const masterKey = config.COSMOSDB_KEY;

export const cosmosdbClient = new CosmosClient({
  endpoint: cosmosDbUri,
  key: masterKey
});

export const cosmosdbReplicaClient = new CosmosClient({
  connectionPolicy: {
    preferredLocations: [config.COSMOSDB_REPLICA_LOCATION]
  },
  endpoint: config.COSMOSDB_REPLICA_URI,
  key: config.COSMOSDB_REPLICA_KEY
});

export const cosmosdbInstance = cosmosdbClient.database(cosmosDbName);
export const cosmosdbInstanceReplica = cosmosdbReplicaClient.database(
  config.COSMOSDB_REPLICA_NAME
);
