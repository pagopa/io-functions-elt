import { RetrievedProfile } from "@pagopa/io-functions-commons/dist/src/models/profile";
import { RetrievedServicePreference } from "@pagopa/io-functions-commons/dist/src/models/service_preference";
import { RetrievedUserDataProcessing } from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { NonEmptyString } from "@pagopa/ts-commons/lib/strings";
import * as t from "io-ts";

export type RetrievedServicePreferenceWithMaybePdvId = t.TypeOf<
  typeof RetrievedServicePreferenceWithMaybePdvId
>;
export const RetrievedServicePreferenceWithMaybePdvId = t.intersection([
  RetrievedServicePreference,
  t.partial({ userPDVId: NonEmptyString })
]);

export type RetrievedUserDataProcessingWithMaybePdvId = t.TypeOf<
  typeof RetrievedUserDataProcessingWithMaybePdvId
>;
export const RetrievedUserDataProcessingWithMaybePdvId = t.intersection([
  RetrievedUserDataProcessing,
  t.partial({ userPDVId: NonEmptyString })
]);

export type RetrievedProfileWithMaybePdvId = t.TypeOf<
  typeof RetrievedProfileWithMaybePdvId
>;
export const RetrievedProfileWithMaybePdvId = t.intersection([
  RetrievedProfile,
  t.partial({ userPDVId: NonEmptyString })
]);
