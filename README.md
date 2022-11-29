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

Create a file `local.settings.json` in your cloned repo by running:

```console
cp ./local.settings.json.example ./local.settings.json
```

### Starting the functions runtime

```
$ yarn start
```
