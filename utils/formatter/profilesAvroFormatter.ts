/* eslint-disable sort-keys */

import * as avro from "avsc";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import { MessageFormatter } from "../kafka/KafkaTypes";
import { messageStatus } from "../../generated/avro/dto/messageStatus";
import { ProfilesCrudOperation as CrudOperation } from "../../generated/avro/dto/ProfilesCrudOperationEnum";
import { RetrievedProfileWithToken } from "../types/retrievedProfileWithToken";
import { profiles } from "../../generated/avro/dto/profiles";
import { toBirthDate } from "../../utils/date";

export const buildAvroServiceObject = (
  retrievedProfile: RetrievedProfileWithToken
): Omit<profiles, "schema" | "subject"> => ({
  token: retrievedProfile.token,
  version: retrievedProfile.version,
  lastAppVersion: retrievedProfile.lastAppVersion || "UNKNOWN",
  monthOfBirth: pipe(
    retrievedProfile.fiscalCode,
    toBirthDate,
    O.map(birthDate => birthDate.getMonth()),
    O.getOrElse(() => -1)
  ),
  yearOfBirth: pipe(
    retrievedProfile.fiscalCode,
    toBirthDate,
    O.map(birthDate => birthDate.getFullYear()),
    O.getOrElse(() => -1)
  ),
  op:
    retrievedProfile.version === 0 ? CrudOperation.CREATE : CrudOperation.UPDATE
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const profilesAvroFormatter = (): MessageFormatter<RetrievedProfileWithToken> => profile => ({
  // pdv token as Partition Key
  key: profile.token,
  value: avro.Type.forSchema(
    profiles.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
  ).toBuffer(
    Object.assign(new messageStatus(), buildAvroServiceObject(profile))
  )
});
