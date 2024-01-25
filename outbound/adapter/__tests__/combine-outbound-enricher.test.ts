import {OutboundEnricher} from "../../port/outbound-enricher";
import * as CEA from "../combine-outbound-enricher";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { failure, success } from "../../port/outbound-publisher";

const aDocument = {
    name: "dummy"
}

const createEnricher = <I>() => {
    const mockEnrich = jest.fn(d => TE.right(d) as TE.TaskEither<Error, I>);
    const mockEnrichs = jest.fn(ds => T.of(ds.map(success)));
    return {
        mockEnrich,
        mockEnrichs,
        enricher: {
            enrich: mockEnrich,
            enrichs: mockEnrichs
        } as OutboundEnricher<I>
    }
}

describe("enrich", () => {
    beforeEach(() => {jest.clearAllMocks()})

    it("GIVEN two working enricher WHEN combine enricher is called THEN it should call both enricher", async () => {
        const first = createEnricher();
        first.mockEnrich.mockImplementationOnce((d) => TE.right({...d, first: true}));
        const second = createEnricher();
        second.mockEnrich.mockImplementationOnce((d) => TE.right({...d, second: true}));

        const combined = CEA.create(first.enricher, second.enricher);
        const result = await combined.enrich(aDocument)();

        expect(first.mockEnrich).toHaveBeenCalledTimes(1);
        expect(second.mockEnrich).toHaveBeenCalledTimes(1);
        expect(result).toEqual(expect.objectContaining({right:{...aDocument, first: true, second: true}}));
    });

    it("GIVEN a working enricher and a failing enricher WHEN combine enricher is called THEN it should call both enricher", async () => {
        const first = createEnricher();
        const second = createEnricher();
        second.mockEnrich.mockImplementationOnce(() => TE.left(new Error("dummy")));

        const combined = CEA.create(first.enricher, second.enricher);
        await combined.enrich(aDocument)();

        expect(first.mockEnrich).toHaveBeenCalledTimes(1);
        expect(second.mockEnrich).toHaveBeenCalledTimes(1);
    });

    it("GIVEN a failing enricher and a working enricher WHEN combine enricher is called THEN it should call only the failing enricher", async () => {
        const first = createEnricher();
        first.mockEnrich.mockImplementationOnce(() => TE.left(new Error("dummy")));
        const second = createEnricher();

        const combined = CEA.create(first.enricher, second.enricher);
        await combined.enrich(aDocument)();

        expect(first.mockEnrich).toHaveBeenCalledTimes(1);
        expect(second.mockEnrich).toHaveBeenCalledTimes(0);
    });
})

describe("enrichs", () => {
    beforeEach(() => {jest.clearAllMocks()})

    it("GIVEN two working enricher WHEN combine enricher is called THEN it should call both enricher", async () => {
        const first = createEnricher();
        first.mockEnrichs.mockImplementation(ds => T.of(ds.map((d: any) => success({...d, first: true}))));
        const second = createEnricher();
        second.mockEnrichs.mockImplementation(ds => T.of(ds.map((d: any) => success({...d, second: true}))));

        const combined = CEA.create(first.enricher, second.enricher);
        const results = await combined.enrichs([aDocument, aDocument])();

        expect(first.mockEnrichs).toHaveBeenCalledTimes(1);
        expect(second.mockEnrichs).toHaveBeenCalledTimes(1);
        expect(results).toEqual(expect.arrayContaining([{success: true, document:{...aDocument, first: true, second: true}}]));
    });

    it("GIVEN a failing enricher and a working enricher WHEN combine enricher is called THEN it should return only failures", async () => {
        const first = createEnricher();
        first.mockEnrichs.mockImplementationOnce(ds => T.of(ds.map((d: any) => failure(new Error("dummy"), d))));
        const second = createEnricher();

        const combined = CEA.create(first.enricher, second.enricher);
        const results = await combined.enrichs([aDocument, aDocument])();

        expect(first.mockEnrichs).toHaveBeenCalledTimes(1);
        expect(first.mockEnrichs).toHaveBeenCalledWith([aDocument, aDocument]);
        expect(second.mockEnrichs).toHaveBeenCalledTimes(1);
        expect(second.mockEnrichs).toHaveBeenCalledWith([]);
        expect(results).toEqual(expect.arrayContaining([{success: false, error: new Error("dummy"), document:aDocument}]));
    });

    it("GIVEN a failing only-once enricher and a working enricher WHEN combine enricher is called THEN it should return a single failure and other successes", async () => {
        const first = createEnricher();
        first.mockEnrichs.mockImplementationOnce((ds: any[]) => T.of([failure(new Error("dummy"), ds[0]), ...ds.slice(1).map(success)]));
        const second = createEnricher();

        const combined = CEA.create(first.enricher, second.enricher);
        const results = await combined.enrichs([aDocument, aDocument])();

        expect(first.mockEnrichs).toHaveBeenCalledTimes(1);
        expect(first.mockEnrichs).toHaveBeenCalledWith([aDocument, aDocument]);
        expect(second.mockEnrichs).toHaveBeenCalledTimes(1);
        expect(second.mockEnrichs).toHaveBeenCalledWith([aDocument]);
        expect(results).toEqual([{success: false, error: new Error("dummy"), document:aDocument}, {success:true, document:aDocument}]);
    });
})