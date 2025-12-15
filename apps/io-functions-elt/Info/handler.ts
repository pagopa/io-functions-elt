import * as healthcheck from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";
import { wrapRequestHandler } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import * as express from "express";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";

import * as packageJson from "../package.json";
import { envConfig, IConfig } from "../utils/config";

type HealthChecker = (
  config: unknown
) => healthcheck.HealthCheck<"AzureCosmosDB" | "Config", true>;

interface IInfo {
  readonly name: string;
  readonly version: string;
}

type InfoHandler = () => Promise<
  IResponseErrorInternal | IResponseSuccessJson<IInfo>
>;

export const InfoHandler =
  (checkApplicationHealth: HealthChecker): InfoHandler =>
  (): Promise<IResponseErrorInternal | IResponseSuccessJson<IInfo>> =>
    pipe(
      envConfig,
      checkApplicationHealth,
      TE.map(() =>
        ResponseSuccessJson({
          name: packageJson.name,
          version: packageJson.version
        })
      ),
      TE.mapLeft((problems) => ResponseErrorInternal(problems.join("\n\n"))),
      TE.toUnion
    )();

export const Info = (): express.RequestHandler => {
  const handler = InfoHandler(
    healthcheck.checkApplicationHealth(IConfig, [
      (c) =>
        healthcheck.checkAzureCosmosDbHealth(c.COSMOSDB_URI, c.COSMOSDB_KEY),
      (c) =>
        healthcheck.checkAzureCosmosDbHealth(
          c.COSMOSDB_REPLICA_URI,
          c.COSMOSDB_REPLICA_KEY
        )
    ])
  );

  return wrapRequestHandler(handler);
};
