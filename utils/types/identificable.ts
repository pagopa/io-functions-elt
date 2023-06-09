import * as t from "io-ts";

export const HasFiscalCode = t.type({
  fiscalCode: t.string
});
export type HasFiscalCode = t.TypeOf<typeof HasFiscalCode>;

export const HasToken = t.type({
  token: t.string
});
export type HasToken = t.TypeOf<typeof HasToken>;

export const HasFiscalCodeAndToken = t.intersection([HasFiscalCode, HasToken]);
export type HasFiscalCodeAndToken = t.TypeOf<typeof HasFiscalCodeAndToken>;
