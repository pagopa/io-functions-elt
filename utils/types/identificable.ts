/* eslint-disable @typescript-eslint/consistent-type-definitions */

export type HasFiscalCode = {
  readonly fiscalCode: string;
};

export type HasToken = {
  readonly token: string | undefined;
};

export type HasFiscalCodeAndToken = HasFiscalCode & HasToken;
