FROM node:20.17.0

WORKDIR /usr/src/app

RUN npm i -g azure-functions-core-tools@2 --unsafe-perm true

ENV AzureWebJobsScriptRoot=/usr/src/app \
  AzureFunctionsJobHost__Logging__Console__IsEnabled=true

CMD ["func", "start", "--javascript"]
