import * as RA from "fp-ts/ReadonlyArray";
import { aRetrievedService, aService } from "../../__mocks__/services.mock";
import { ProducerRecord } from "kafkajs";
import { handle } from "../handler";
import { TelemetryClient } from "../../utils/appinsights";
import { mockProducerCompact } from "../../utils/kafka/__mocks__/KafkaProducerCompact";

const mockTelemetryClient = ({
  trackException: jest.fn(_ => void 0)
} as unknown) as TelemetryClient;

const dummyProducerCompact = mockProducerCompact(aRetrievedService);

describe("handle test", () => {
  beforeEach(() => jest.clearAllMocks());

  it("GIVEN a working kafka producer and a valid service list WHEN publish is called THEN the publish return no errors and no error has been stored", async () => {
    const messages = [aRetrievedService];
    const response = await handle(
      messages,
      mockTelemetryClient,
      dummyProducerCompact.getClient
    );
    expect(response).toStrictEqual({
      isSuccess: true,
      result: "Documents sent 1. Retriable Errors: 0. Not Retriable Errors: 0."
    });
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(0);
  });

  it("GIVEN a working kafka producer and a not valid service list WHEN publish is called THEN the publish return a decode error and the decode error is stored", async () => {
    const messages = [aService];
    const response = await handle(
      messages,
      mockTelemetryClient,
      dummyProducerCompact.getClient
    );
    expect(response).toStrictEqual({
      isSuccess: false,
      result: "Documents sent 0. Retriable Errors: 0. Not Retriable Errors: 1."
    });
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(1);
  });

  it("GIVEN a working kafka producer and a partially valid service list WHEN publish is called THEN the publish return a decode error and each decode errors are stored", async () => {
    const messages = [aService, aRetrievedService];
    const response = await handle(
      messages,
      mockTelemetryClient,
      dummyProducerCompact.getClient
    );
    expect(response).toStrictEqual({
      isSuccess: false,
      result: "Documents sent 1. Retriable Errors: 0. Not Retriable Errors: 1."
    });
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(1);
  });

  it("GIVEN a not working kafka producer and a valid service list WHEN publish is called THEN the publish throw an error", async () => {
    dummyProducerCompact.producer.send.mockImplementationOnce(
      async (pr: ProducerRecord) =>
        RA.replicate(2, {
          errorCode: 2, // a retriable error code
          partition: 1,
          topicName: pr.topic
        })
    );
    const messages = [aRetrievedService, aRetrievedService];
    await expect(
      handle(messages, mockTelemetryClient, dummyProducerCompact.getClient)
    ).rejects.toEqual(expect.objectContaining({ body: aRetrievedService }));
    expect(mockTelemetryClient.trackException).toHaveBeenCalledTimes(2);
  });
});
