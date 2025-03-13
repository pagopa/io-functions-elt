/* eslint-disable sort-keys */
import * as avro from "avsc";

import { profileDeletion } from "../../generated/avro/dto/profileDeletion";
import { MessageFormatter } from "../kafka/KafkaTypes";
import { RetrievedUserDataProcessingWithMaybePdvId } from "../types/decoratedTypes";

// remove me
export const buildAvroDeleteObject = (
  retrievedUserDataProcessingWithPdvId: RetrievedUserDataProcessingWithMaybePdvId
): Omit<profileDeletion, "schema" | "subject"> => ({
  userPDVId: retrievedUserDataProcessingWithPdvId.userPDVId ?? "UNDEFINED",
  // eslint-disable-next-line no-underscore-dangle
  deletedAt: retrievedUserDataProcessingWithPdvId._ts * 1000
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const profileDeletionAvroFormatter =
  (): MessageFormatter<RetrievedUserDataProcessingWithMaybePdvId> =>
  (deleteProfileWithPdvId) => {
    const avroObject = buildAvroDeleteObject(deleteProfileWithPdvId);

    return {
      // pdvId as Partition Key
      key: avroObject.userPDVId,
      value: avro.Type.forSchema(
        profileDeletion.schema as avro.Schema // cast due to tsc can not proper recognize object as avro.Schema (eg. if you use const schemaServices: avro.Type = JSON.parse(JSON.stringify(services.schema())); it will loose the object type and it will work fine)
      ).toBuffer(Object.assign(new profileDeletion(), avroObject))
    };
  };
