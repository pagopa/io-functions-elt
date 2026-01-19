/** Partially generated with ts-to-io lib */
/** TODO: improve ts-to-io to use type-from-string decoder from ts-commons */

import { BooleanFromString } from "@pagopa/ts-commons/lib/booleans";
import { CommaSeparatedListOf } from "@pagopa/ts-commons/lib/comma-separated-list";
import { IntegerFromString } from "@pagopa/ts-commons/lib/numbers";
import * as t from "io-ts";
import { CompressionTypes } from "kafkajs";

export const ValidableKafkaProducerConfig = t.intersection([
  t.intersection([
    t.type({
      brokers: t.union([
        t.array(t.string),
        t.Function,
        CommaSeparatedListOf(t.string)
      ])
    }),
    t.partial({
      authenticationTimeout: t.union([t.undefined, IntegerFromString]),
      clientId: t.union([t.undefined, t.string]),
      connectionTimeout: t.union([t.undefined, IntegerFromString]),
      enforceRequestTimeout: t.union([t.undefined, BooleanFromString]),
      logCreator: t.union([t.undefined, t.Function]),
      reauthenticationThreshold: t.union([t.undefined, IntegerFromString]),
      requestTimeout: t.union([t.undefined, IntegerFromString]),
      retry: t.union([
        t.undefined,
        t.partial({
          factor: t.union([t.undefined, IntegerFromString]),
          initialRetryTime: t.union([t.undefined, IntegerFromString]),
          maxRetryTime: t.union([t.undefined, IntegerFromString]),
          multiplier: t.union([t.undefined, IntegerFromString]),
          retries: t.union([t.undefined, IntegerFromString])
        })
      ]),
      sasl: t.union([
        t.undefined,
        t.intersection([
          t.type({ mechanism: t.literal("plain") }),
          t.type({ password: t.string, username: t.string })
        ]),
        t.intersection([
          t.type({ mechanism: t.literal("scram-sha-256") }),
          t.type({ password: t.string, username: t.string })
        ]),
        t.intersection([
          t.type({ mechanism: t.literal("scram-sha-512") }),
          t.type({ password: t.string, username: t.string })
        ]),
        t.intersection([
          t.type({ mechanism: t.literal("aws") }),
          t.intersection([
            t.type({
              accessKeyId: t.string,
              authorizationIdentity: t.string,
              secretAccessKey: t.string
            }),
            t.partial({ sessionToken: t.union([t.undefined, t.string]) })
          ])
        ]),
        t.intersection([
          t.type({ mechanism: t.literal("oauthbearer") }),
          t.type({ oauthBearerProvider: t.Function })
        ])
      ]),
      socketFactory: t.union([t.undefined, t.Function]),
      ssl: t.union([t.undefined, BooleanFromString])
    })
  ]),
  t.partial({
    allowAutoTopicCreation: t.union([t.undefined, BooleanFromString]),
    createPartitioner: t.union([t.undefined, t.Function]),
    idempotent: t.union([t.undefined, BooleanFromString]),
    maxInFlightRequests: t.union([t.undefined, IntegerFromString]),
    metadataMaxAge: t.union([t.undefined, IntegerFromString]),
    retry: t.union([
      t.undefined,
      t.partial({
        factor: t.union([t.undefined, IntegerFromString]),
        initialRetryTime: t.union([t.undefined, IntegerFromString]),
        maxRetryTime: t.union([t.undefined, IntegerFromString]),
        multiplier: t.union([t.undefined, IntegerFromString]),
        retries: t.union([t.undefined, IntegerFromString])
      })
    ]),
    transactionalId: t.union([t.undefined, t.string]),
    transactionTimeout: t.union([t.undefined, IntegerFromString])
  })
]);

export const MessageFormatter = t.Function;

export const KafkaProducerTopicConfig = t.intersection([
  t.type({ topic: t.string }),
  t.partial({
    acks: t.union([t.undefined, IntegerFromString]),
    compression: t.union([
      t.undefined,
      t.literal(CompressionTypes.None),
      t.literal(CompressionTypes.GZIP),
      t.literal(CompressionTypes.Snappy),
      t.literal(CompressionTypes.LZ4),
      t.literal(CompressionTypes.ZSTD)
    ]),
    messageFormatter: t.union([t.undefined, t.Function]),
    timeout: t.union([t.undefined, IntegerFromString])
  })
]);

export const KafkaProducerCompactConfig = t.intersection([
  ValidableKafkaProducerConfig,
  KafkaProducerTopicConfig
]);
