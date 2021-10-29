# IO Functions ELT

Azure function used to export data outside App IO ecosystems.

## Architecture

The project is structured as follows:

* `CosmosApiServicesChangeFeed`: handle the change data capture for registered Services fetching data from cosmosdb via change feed and publishing them on a kafka complient topic.
* `CosmosApiServicesImportEvent`: perfrom a massive export of all registered Services from cosmosdb. The operation is triggered by an import command message on a kafka complient topic.

### Setup

Install the [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools).

Install the dependencies:

```
$ yarn install
```

Create a file `local.settings.json` in your cloned repo, with the
following contents:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "<JOBS_STORAGE_CONNECTION_STRING>",
    "COSMOSDB_NAME": "<COSMOSDB_DB_NAME>",
    "COSMOSDB_KEY": "<COSMOSDB_KEY>",
    "COSMOSDB_URI": "<COSMOSDB_URI>", 
    "COSMOS_API_CONNECTION_STRING": "<SOURCE_COSMOSDB_CONNECTION_STRING>",
    "TARGETKAFKA_clientId": "IO_FUNCTIONS_ELT",
    "TARGETKAFKA_brokers": "<KAFKA_COMPLIENT_BROKERS>",
    "TARGETKAFKA_ssl": "true",
    "TARGETKAFKA_sasl_mechanism": "plain",
    "TARGETKAFKA_sasl_username": "<KAFKA_COMPLIENT_USERNAME>",
    "TARGETKAFKA_sasl_password": "<KAFKA_COMPLIENT_PASSWORD>",
    "TARGETKAFKA_maxInFlightRequests": "1",
    "TARGETKAFKA_idempotent": "true",
    "TARGETKAFKA_transactionalId": "IO_ELT",
    "TARGETKAFKA_topic": "io-cosmosdb-services",
    "ERROR_STORAGE_ACCOUNT": "<ERROR_AZURE_STORAGE_ACCOUNT_NAME>",
    "ERROR_STORAGE_KEY": "<ERROR_AZURE_STORAGE_KEY>",
    "ERROR_STORAGE_TABLE": "<ERROR_AZURE_STORAGE_TABLE_NAME>",
    "COMMAND_STORAGE": "<COMMAND_STORAGE_CONNECTION_STRING>",
    "COMMAND_STORAGE_TABLE": "<COMMAND_STORAGE_TABLE_NAME>",
    "IMPORT_TOPIC_NAME": "import-services",
    "IMPORT_TOPIC_CONNECTION_STRING": "KAFKA_COMPLIENT_CONNECTION_STRING"
  },
  "ConnectionStrings": {}
}
```

### Starting the functions runtime

```
$ yarn start
```
