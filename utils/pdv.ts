import * as crypto from "crypto";
import * as TE from "fp-ts/TaskEither";

import { FiscalCode, NonEmptyString } from "@pagopa/ts-commons/lib/strings";

// TODO: Remove as soon as PDV service is called
export const sha256 = (s: string): NonEmptyString =>
  crypto
    .createHash("sha256")
    .update(s)
    .digest("hex") as NonEmptyString;

export const getPdvId: (
  fiscalCode: FiscalCode
) => TE.TaskEither<Error, NonEmptyString> = fiscalCode =>
  // Return the hash of the fiscal code, as mocked PDV Id
  TE.of(sha256(fiscalCode));
