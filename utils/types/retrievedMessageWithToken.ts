import { RetrievedMessage } from "@pagopa/io-functions-commons/dist/src/models/message";
import * as t from "io-ts";
import { HasToken } from "./identificable";

export const RetrievedMessageWithToken = t.intersection([
  RetrievedMessage,
  HasToken
]);
export type RetrievedMessageWithToken = t.TypeOf<
  typeof RetrievedMessageWithToken
>;
