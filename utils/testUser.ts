import { CommaSeparatedListOf } from "@pagopa/ts-commons/lib/comma-separated-list";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { GzipCompressedString } from "./types/gzipCompressedString";

/**
 * Determine if a test user is detected
 * @argument CF of the user
 * @argument Set of enabled Test users
 * @returns boolean
 */
export const isTestUser: (
  cf: FiscalCode,
  testUsersSet: Set<FiscalCode>
) => boolean = (cf, testUsersSet) => testUsersSet.has(cf);

export const TestUsersArrayDecoder = GzipCompressedString.pipe(
  CommaSeparatedListOf(FiscalCode)
);
