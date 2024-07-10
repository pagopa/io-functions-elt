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

    it("GIVEN a working PDV client WHEN enrich an object with a fiscalCode THEN the object is enriched with the token", async () => {
        const {mockSaveUsingPUT, client} = mockAPIClient();
        const adapter = create(client);

        const objectToEnrich = {fiscalCode: aFiscalCode, token: ""};
        const result =  await adapter.enrich(objectToEnrich)();

        expect(mockSaveUsingPUT).toHaveBeenCalledWith({
            body: { pii: aFiscalCode }
          });
        expect(result).toEqual(expect.objectContaining({right: {fiscalCode: aFiscalCode, token: aToken}}));
    });

    it("GIVEN a not working PDV client WHEN enrich an object with a fiscalCode THEN the object is enriched with the token", async () => {
        const {mockSaveUsingPUT, client} = mockAPIClient();
        mockSaveUsingPUT.mockImplementationOnce(async () => {throw new Error();})
        const adapter = create(client);

        const objectToEnrich = {fiscalCode: aFiscalCode, token: ""};
        const result =  await adapter.enrich(objectToEnrich)();

        expect(mockSaveUsingPUT).toHaveBeenCalledWith({
            body: { pii: aFiscalCode }
          });
        expect(result).toEqual(expect.objectContaining({left: expect.any(Error)}));
    })

    it("GIVEN a PDV client returning 500WHEN enrich an object with a fiscalCode THEN the object is enriched with the token", async () => {
        const {mockSaveUsingPUT, client} = mockAPIClient();
        mockSaveUsingPUT.mockImplementationOnce(async () => TE.right({
            status: 500
        })());
        const adapter = create(client);

        const objectToEnrich = {fiscalCode: aFiscalCode, token: ""};
        const result =  await adapter.enrich(objectToEnrich)();

        expect(mockSaveUsingPUT).toHaveBeenCalledWith({
            body: { pii: aFiscalCode }
          });
        expect(result).toEqual(expect.objectContaining({left: expect.any(Error)}));
    })

});