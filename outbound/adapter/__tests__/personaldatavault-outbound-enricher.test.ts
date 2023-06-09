import { ResponseSuccessJson } from "@pagopa/ts-commons/lib/responses";
import {APIClient} from "../../../clients/personalDataValult"
import {aFiscalCode, aToken} from "../../../__mocks__/profiles.mock";
import {create} from "../personaldatavault-outbound-enricher";
import * as TE from "fp-ts/TaskEither";

const mockAPIClient = () => {
    const mockSaveUsingPUT = jest.fn().mockImplementation(async () => TE.right({
        status: 200,
        value: {token: aToken}
    })());

    return {
        mockSaveUsingPUT,
        client: {
            saveUsingPUT: mockSaveUsingPUT,
        } as unknown as APIClient};
};

describe("enrich", () => {
    beforeEach(() => jest.clearAllMocks());

    it("GIVEN an object with a fiscalCode WHEN enrich THEN the object is enriched with the token", async () => {
        const {mockSaveUsingPUT, client} = mockAPIClient();
        const objectToEnrich = {fiscalCode: aFiscalCode, token: ""};
        const adapter = create(client);

        const result =  await adapter.enrich(objectToEnrich)();

        expect(mockSaveUsingPUT).toHaveBeenCalledWith({
            body: { pii: aFiscalCode }
          });
        expect(result).toEqual(expect.objectContaining({right: {fiscalCode: aFiscalCode, token: aToken}}));
    });

});