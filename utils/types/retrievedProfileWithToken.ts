import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import * as t from "io-ts";

export const RetrievedProfileWithToken = t.intersection([
  RetrievedProfile,
  t.type({ token: t.union([t.string, t.undefined]) })
]);
export type RetrievedProfileWithToken = t.TypeOf<
  typeof RetrievedProfileWithToken
>;
