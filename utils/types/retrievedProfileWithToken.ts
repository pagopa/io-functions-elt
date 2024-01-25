import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import * as t from "io-ts";
import { HasToken } from "./identificable";

export const RetrievedProfileWithToken = t.intersection([
  RetrievedProfile,
  HasToken
]);
export type RetrievedProfileWithToken = t.TypeOf<
  typeof RetrievedProfileWithToken
>;
