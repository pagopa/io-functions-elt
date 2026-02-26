# IO Functions ELT

Azure function used to export data outside App IO ecosystems.

## Architecture

The project is structured as follows:


### Setup

Install the [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools).

Install the dependencies:

```bash
$ yarn install
```

Create a file `local.settings.json` in your cloned repo by running:

```bash
$ cp ./local.settings.json.example ./local.settings.json
```

### Starting the functions runtime

```bash
$ yarn start
```
