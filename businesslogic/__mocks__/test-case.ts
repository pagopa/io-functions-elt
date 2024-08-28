import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { sha256 } from "../../utils/pdv";
import {
  aTopic,
  mockGetPdvId,
  mockSendMessageViaQueue,
  mockSendMessageViaTopic,
  mockTrackException
} from "./processor.mock";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";

export const getSuccessValidListExpects = <
  T extends { fiscalCode: FiscalCode }
>(
  documents: Array<T>
) => {
  expect(mockGetPdvId).toHaveBeenCalledTimes(2);
  expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
  expect(mockSendMessageViaTopic).toHaveBeenCalledWith({
    messages: documents.map(document => ({
      value: JSON.stringify({
        ...document,
        // enriched values
        userPDVId: sha256(document.fiscalCode)
      })
    })),
    topic: aTopic
  });
  expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(0);
  expect(mockTrackException).toHaveBeenCalledTimes(0);
};

export const getKafkaProducerFailureExpects = <
  T extends { fiscalCode: FiscalCode }
>(
  documents: Array<T>
) => {
  expect(mockGetPdvId).toHaveBeenCalledTimes(2);
  expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
  expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(2);
  pipe(
    documents,
    RA.mapWithIndex((i, document) =>
      expect(mockSendMessageViaQueue).toHaveBeenNthCalledWith(
        i + 1,
        Buffer.from(
          JSON.stringify({
            ...document
            // DO NOT store pdvId values
            // userPDVId: sha256(document.fiscalCode)
          })
        ).toString("base64")
      )
    )
  );
  expect(mockTrackException).toHaveBeenCalledTimes(0);
};

export const getEnricherFailureExpecter = <
  T extends { fiscalCode: FiscalCode }
>(
  documents: Array<T>
) => {
  expect(mockGetPdvId).toHaveBeenCalledTimes(2);
  expect(mockSendMessageViaTopic).toHaveBeenCalledTimes(1);
  expect(mockSendMessageViaQueue).toHaveBeenCalledTimes(1);
  pipe(
    [documents[0]],
    RA.mapWithIndex((i, document) =>
      expect(mockSendMessageViaQueue).toHaveBeenNthCalledWith(
        i + 1,
        Buffer.from(
          JSON.stringify({
            ...document
            // DO NOT store pdvId values
            // userPDVId: sha256(document.fiscalCode)
          })
        ).toString("base64")
      )
    )
  );
  expect(mockTrackException).toHaveBeenCalledTimes(0);
};
