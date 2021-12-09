/**
 * Config module
 *
 * Single point of access for the application confguration. Handles validation on required environment variables.
 * The configuration is evaluate eagerly at the first access to the module. The module exposes convenient methods to access such value.
 */
import * as t from "io-ts";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as R from "fp-ts/Record";
import * as S from "fp-ts/string";
import { set } from "lodash";

import { readableReport } from "@pagopa/ts-commons/lib/reporters";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import { IntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import { withDefault } from "@pagopa/ts-commons/lib/types";

import { KafkaProducerCompactConfig } from "./IoKafkaTypes";

const isRecordOfString = (i: unknown): i is Record<string, unknown> =>
  typeof i === "object" &&
  i !== null &&
  !Object.keys(i).some(property => typeof property !== "string");

const createNotRecordOfStringErrorL = (
  input: unknown,
  context: t.Context
) => (): t.Errors => [
  {
    context,
    message: "input is not a valid record of string",
    value: input
  }
];

/**
 * This functions create an object containig only the properties starting with 'prefix'. The env properties name will be splited using '_' to create nested object.
 * eg. TARGETKAFKA_client_id: 1234 => { client: { id: 1234 } }
 *
 * @param env the input env
 * @param prefix the properties prefix
 * @returns a object
 */
export const nestifyPrefixedType = (
  env: Record<string, unknown>,
  prefix: string
): Record<string, unknown> =>
  pipe(
    env,
    R.filterWithIndex(fieldName => fieldName.split("_")[0] === prefix),
    R.reduceWithIndex(S.Ord)({}, (k, b, a) =>
      set(
        b,
        // eslint-disable-next-line functional/immutable-data
        k
          .split("_")
          .splice(1)
          .join("."),
        a
      )
    )
  );

export type KafkaProducerCompactConfig = t.TypeOf<
  typeof KafkaProducerCompactConfig
>;
export const KafkaProducerCompactConfigFromEnv = new t.Type<
  KafkaProducerCompactConfig,
  KafkaProducerCompactConfig,
  unknown
>(
  "KafkaProducerCompactConfigFromEnv",
  (u: unknown): u is KafkaProducerCompactConfig =>
    KafkaProducerCompactConfig.is(u),
  (input, context) =>
    pipe(
      input,
      E.fromPredicate(
        isRecordOfString,
        createNotRecordOfStringErrorL(input, context)
      ),
      E.chainW(inputRecord =>
        KafkaProducerCompactConfig.validate(
          nestifyPrefixedType(inputRecord, "TARGETKAFKA"),
          context
        )
      )
    ),
  t.identity
);

// global app configuration
export type IDecodableConfig = t.TypeOf<typeof IDecodableConfig>;
export const IDecodableConfig = t.interface({
  COSMOSDB_KEY: NonEmptyString,
  COSMOSDB_NAME: NonEmptyString,
  COSMOSDB_URI: NonEmptyString,

  // eslint-disable-next-line sort-keys
  COSMOSDB_REPLICA_KEY: NonEmptyString,
  COSMOSDB_REPLICA_LOCATION: withDefault(
    NonEmptyString,
    "North Europe" as NonEmptyString
  ),
  COSMOSDB_REPLICA_NAME: NonEmptyString,
  COSMOSDB_REPLICA_URI: NonEmptyString,

  ERROR_STORAGE_ACCOUNT: NonEmptyString,
  ERROR_STORAGE_KEY: NonEmptyString,
  ERROR_STORAGE_TABLE: NonEmptyString,

  // eslint-disable-next-line sort-keys
  COMMAND_STORAGE: NonEmptyString,
  MESSAGE_EXPORT_STEP_1_CONTAINER: NonEmptyString,
  MESSAGE_EXPORT_STEP_FINAL_CONTAINER: NonEmptyString,

  // eslint-disable-next-line sort-keys
  COSMOS_CHUNK_SIZE: IntegerFromString,
  COSMOS_DEGREE_OF_PARALLELISM: IntegerFromString,

  MESSAGE_CONTENT_CHUNK_SIZE: IntegerFromString,
  MessageContentStorageConnection: NonEmptyString,
  ServiceInfoBlobStorageConnection: NonEmptyString,

  isProduction: t.boolean
});

export interface IParsableConfig {
  readonly targetKafka: KafkaProducerCompactConfig;
  // readonly servicesTopic: KafkaProducerTopicConfig;
}

export const parseConfig = (input: unknown): t.Validation<IParsableConfig> =>
  pipe(
    E.Do,
    E.bind("targetKafka", () => KafkaProducerCompactConfigFromEnv.decode(input))
    // E.bind("servicesTopic", () => KafkaProducerTopicConfigFromEnv.decode(input))
  );

export type IConfig = IDecodableConfig & IParsableConfig;
export const IConfig = new t.Type<IConfig>(
  "IConfig",
  (u: unknown): u is IConfig => IDecodableConfig.is(u),
  (input, context) =>
    pipe(
      E.Do,
      E.bind("dc", () => IDecodableConfig.validate(input, context)),
      E.bind("pc", () => parseConfig(input)),
      E.map(({ dc, pc }) => ({ ...dc, ...pc }))
    ),
  t.identity
);

export const envConfig = {
  ...process.env,
  isProduction: process.env.NODE_ENV === "production"
};

const errorOrConfig: t.Validation<IConfig> = IConfig.decode(envConfig);

/**
 * Read the application configuration and check for invalid values.
 * Configuration is eagerly evalued when the application starts.
 *
 * @returns either the configuration values or a list of validation errors
 */
export const getConfig = (): t.Validation<IConfig> => errorOrConfig;

/**
 * Read the application configuration and check for invalid values.
 * If the application is not valid, raises an exception.
 *
 * @returns the configuration values
 * @throws validation errors found while parsing the application configuration
 */
export const getConfigOrThrow = (): IConfig =>
  pipe(
    errorOrConfig,
    E.getOrElseW((errors: ReadonlyArray<t.ValidationError>) => {
      throw new Error(`Invalid configuration: ${readableReport(errors)}`);
    })
  );
