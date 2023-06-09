import * as E from "fp-ts/Either"
import * as O from "fp-ts/Option"
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import {
  toBirthDate,
} from "../date";

const toDate = new Date("2020-01-01");
const olderThanValue = 18;

const aFiscalCode = "DROLSS85S20H501F" as FiscalCode;
const aWrongFiscalCode = "DROLSS85Z20H501F" as FiscalCode;
const aDateOfBirth = new Date(1985, 10, 20);

describe("User utility", () => {
  it("should extract the correct date of birth from fiscalCode", async () => {
    const extractedDateOfBirthOrError = toBirthDate(aFiscalCode);
    expect(O.isSome(extractedDateOfBirthOrError)).toBeTruthy();
    if (O.isSome(extractedDateOfBirthOrError)) {
      const birthDate = extractedDateOfBirthOrError.value;
      expect(birthDate.getFullYear()).toEqual(aDateOfBirth.getFullYear());
      expect(birthDate.getDay()).toEqual(aDateOfBirth.getDay());
      expect(birthDate.getMonth()).toEqual(aDateOfBirth.getMonth());
    }
  });

  it("should return none if fiscalCode is not recognized", async () => {
    const extractedDateOfBirthOrError = toBirthDate(aWrongFiscalCode);
    expect(O.isNone(extractedDateOfBirthOrError)).toBeTruthy();
  });
});
