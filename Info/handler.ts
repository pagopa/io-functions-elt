/* eslint-disable @typescript-eslint/explicit-function-return-type */

import * as healthcheck from "@pagopa/io-functions-commons/dist/src/utils/healthcheck";
import { wrapRequestHandler } from "@pagopa/io-functions-commons/dist/src/utils/request_middleware";
import {
  IResponseErrorInternal,
  IResponseSuccessJson,
  ResponseErrorInternal,
  ResponseSuccessJson
} from "@pagopa/ts-commons/lib/responses";
import * as express from "express";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";

import * as packageJson from "../package.json";
import { IConfig, envConfig } from "../utils/config";

interface IInfo {
  readonly name: string;
  readonly version: string;
}

type InfoHandler = () => Promise<
  IResponseSuccessJson<IInfo> | IResponseErrorInternal
>;

type HealthChecker = (
  config: unknown
) => healthcheck.HealthCheck<"Config" | "AzureCosmosDB", true>;

export const InfoHandler =
  (checkApplicationHealth: HealthChecker): InfoHandler =>
  (): Promise<IResponseSuccessJson<IInfo> | IResponseErrorInternal> =>
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
