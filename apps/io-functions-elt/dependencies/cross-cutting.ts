/**
 * Cross-cutting shared dependencies.
 *
 * Config, PDV tokenizer, Redis, Application Insights telemetry,
 * and the internal-test fiscal code set used by all domain filterers.
 */

import { FiscalCode } from "@pagopa/ts-commons/lib/strings";

import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import { getConfigOrThrow } from "../utils/config";
import { httpOrHttpsApiFetch } from "../utils/fetch";
import { pdvTokenizerClient } from "../utils/pdvTokenizerClient";
import { createRedisClientSingleton } from "../utils/redis";

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
export const config = getConfigOrThrow();

// ---------------------------------------------------------------------------
// PDV TOKENIZER
// ---------------------------------------------------------------------------
export const pdvTokenizer = pdvTokenizerClient(
  config.PDV_TOKENIZER_BASE_URL,
  config.PDV_TOKENIZER_API_KEY,
  httpOrHttpsApiFetch,
  config.PDV_TOKENIZER_BASE_PATH
);

// ---------------------------------------------------------------------------
// REDIS
// ---------------------------------------------------------------------------
export const redisClientTask = createRedisClientSingleton(config);

// ---------------------------------------------------------------------------
// TELEMETRY
// ---------------------------------------------------------------------------
export const telemetryClient = TA.initTelemetryClient(
  config.APPLICATIONINSIGHTS_CONNECTION_STRING
);

export const telemetryAdapter = TA.create(telemetryClient);

// ---------------------------------------------------------------------------
// INTERNAL TEST FISCAL CODES
// ---------------------------------------------------------------------------
export const internalTestFiscalCodeSet = new Set(
  config.INTERNAL_TEST_FISCAL_CODES_COMPRESSED as readonly FiscalCode[]
);
