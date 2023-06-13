import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { RetrievedMessageWithToken } from "../utils/types/retrievedMessageWithToken";
import { OutboundPublisher, success } from "../outbound/port/outbound-publisher";
import { aToken } from "./profiles.mock";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { QueueClient } from "@azure/storage-queue";
import { Producer, ProducerRecord } from "kafkajs";
import { pipe } from "fp-ts/lib/function";
import * as RA from "fp-ts/ReadonlyArray";
import * as EA from "../outbound/adapter/messages-outbound-enricher";
import * as O from "fp-ts/Option";
import { aMessageContent } from "./messages.mock";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import { TelemetryClient } from "applicationinsights";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as QA from "../outbound/adapter/queue-outbound-publisher";


export const aTopic = "a-topic";
export const anError = new Error("An error");
export const aKafkaResponse = {
  errorCode: 0,
  partition: 1,
  topicName: aTopic
};

export const mockPersonalDataVaultEnricher = <I>() => {
    const mockEnrich = jest.fn(d => TE.right(d) as TE.TaskEither<Error, I>);
    const mockEnrichs = jest.fn(ds => T.of(ds.map((d: any) => success({...d, token: aToken}))));
    return {
        mockEnrich,
        mockEnrichs,
        adapter: {
            enrich: mockEnrich,
            enrichs: mockEnrichs
        } as OutboundEnricher<I>
    }
}

export const mockQueueClient = () => {
    const mockSendMessage = jest.fn(() => Promise.resolve());
    return {
      mockSendMessage,
      client: ({
        sendMessage: mockSendMessage
      } as unknown) as QueueClient
    };
  };

export const mockQueuePublisherAdapter = <I>() => {
    const queue = mockQueueClient();
    const adapter = QA.create(queue.client) as OutboundPublisher<I>;
    return {
        queue,
        adapter
    }
};
  
export const mockKafkaProducer = () => {
    const mockSend = jest.fn(async (pr: ProducerRecord) =>
        pipe(
        pr.messages,
        RA.map(() => aKafkaResponse)
        )
    );
    return {
        mockSend,
        producer: () => ({
            producer: ({
              connect: jest.fn(async () => void 0),
              disconnect: jest.fn(async () => void 0),
              send: mockSend
            } as unknown) as Producer,
            topic: { topic: aTopic }
          })
    }
}

export const mockKafkaPublisherAdapter = <I>() => {
    const kafkaProducer = mockKafkaProducer();
    const adapter = KA.create(kafkaProducer.producer) as OutboundPublisher<I>;
    return {
        kafkaProducer,
        adapter
    }
}

export const mockMessageEnrichAdapter = () => {
    const mockGetContentFromBlob = jest.fn(() => TE.of(O.some(aMessageContent)));
    const adapter = EA.create(
        {
            getContentFromBlob: mockGetContentFromBlob
        } as any,
        {} as any,
        500
    );
    return {
        mockGetContentFromBlob,
        adapter
    }
};

export const mockApplicationInsight = () => {
    const mockTrackException = jest.fn(_ => void 0);
    return {
        mockTrackException,
        client: ({
            trackException: mockTrackException
          } as unknown) as TelemetryClient
    }
}

export const mockTrackerAdapter = () => {
    const applicationisight = mockApplicationInsight();
    return {
        applicationisight,
        adapter: TA.create(applicationisight.client)
    };
};
