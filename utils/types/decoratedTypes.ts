import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

export type RetrievedServicePreferenceWithMaybePdvId = t.TypeOf<
  typeof RetrievedServicePreferenceWithMaybePdvId
>;
const RetrievedServicePreferenceWithMaybePdvId = t.intersection([
  RetrievedServicePreference,
  t.partial({ userPDVId: NonEmptyString })
]);
