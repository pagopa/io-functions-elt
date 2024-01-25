/* eslint-disable @typescript-eslint/consistent-type-definitions */
import * as t from "io-ts";

export const HasFiscalCode = t.type({
  fiscalCode: t.string
});
export type HasFiscalCode = t.TypeOf<typeof HasFiscalCode>;

export const HasToken = t.partial({
  token: t.string
});
export type HasToken = t.TypeOf<typeof HasToken>;

export const HasFiscalCodeAndToken = t.intersection([HasFiscalCode, HasToken]);
export type HasFiscalCodeAndToken = HasFiscalCode & HasToken;
