import { agent } from "@pagopa/ts-commons";
import {
  AbortableFetch,
  setFetchTimeout,
  toFetch
} from "@pagopa/ts-commons/lib/fetch";
import { Millisecond } from "@pagopa/ts-commons/lib/units";
import { createClient } from "../generated/pdv/client";

import { getConfigOrThrow } from "../utils/config";

const config = getConfigOrThrow();

export const personalDataVaultBaseUrl = config.PERSONAL_DATA_VAULT_BASE_URL;
export const personalDataVaultApiKey = config.PERSONAL_DATA_VAULT_API_KEY;

// 5 seconds timeout by default
const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

// Must be an https endpoint so we use an https agent
const abortableFetch = AbortableFetch(agent.getHttpsFetch(process.env));
const fetchWithTimeout = toFetch(
  setFetchTimeout(DEFAULT_REQUEST_TIMEOUT_MS as Millisecond, abortableFetch)
);

const fetchApi: typeof fetchWithTimeout = fetchWithTimeout;

export const personalDataVaultClient = createClient<"api_key">({
  basePath: "",
  baseUrl: personalDataVaultBaseUrl,
  fetchApi,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  withDefaults: op => params =>
    op({ api_key: personalDataVaultApiKey, ...params })
});

export type APIClient = typeof personalDataVaultClient;
