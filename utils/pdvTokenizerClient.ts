import nodeFetch from "node-fetch";
import { Client, createClient } from "../generated/pdv-tokenizer-api/client";

export const pdvTokenizerClient = (
  baseUrl: string,
  token: string,
  fetchApi: typeof fetch = (nodeFetch as unknown) as typeof fetch
): Client<"api_key"> =>
  createClient<"api_key">({
    baseUrl,
    fetchApi,
    withDefaults: (
      op
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    ) => params =>
      // @ts-expect-error necessary because the codegen does not aggregate well all request types,
      // requiring a mandatory body in all requests in this case
      op({
        ...params,
        // please refer to source api spec for actual header mapping
        // https://github.com/pagopa/io-functions-app/blob/master/openapi/index.yaml#:~:text=%20%20SubscriptionKey:
        api_key: token
      })
  });

export type PdvTokenizerClient = ReturnType<typeof pdvTokenizerClient>;
