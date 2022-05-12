import {
  KafkaProducerCompact,
  IKafkaProducerCompact
} from "../KafkaProducerCompact";
import * as TE from "fp-ts/TaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import { IStorableSendFailureError } from "../KafkaOperation";
import { Producer, RecordMetadata, ProducerRecord } from "kafkajs";
import { pipe } from "fp-ts/lib/function";
import {
  ValidableKafkaProducerConfig,
  KafkaProducerTopicConfig
} from "../KafkaTypes";
import * as KP from "../KafkaProducerCompact";

export const topic = "aTopic";

export const mockProducer = () => ({
  connect: jest.fn(async () => void 0),
  disconnect: jest.fn(async () => void 0),
  send: jest.fn(async (pr: ProducerRecord) =>
    pipe(
      pr.messages,
      RA.map(
        () =>
          ({
            errorCode: 0,
            partition: 1,
            topicName: pr.topic
          } as RecordMetadata)
      )
    )
  ),
  sendBatch: jest.fn(async _ => {
    [] as ReadonlyArray<RecordMetadata>;
  })
});

interface IDummyProducerCompact<T> {
  producer: ReturnType<typeof mockProducer>;
  getClient: KP.KafkaProducerCompact<T>;
}

export const mockProducerCompact = <T>(_: T): IDummyProducerCompact<T> => {
  const dummyProducer = mockProducer();
  return {
    producer: dummyProducer,
    getClient: () => ({
      producer: (dummyProducer as unknown) as Producer,
      topic: { topic }
    })
  };
};

let sendMessageSuccess: "NOERROR" | "ERROR" = "NOERROR";

export const __setSendMessageSuccess = () => (sendMessageSuccess = "NOERROR");
export const __setSendMessageError = () => (sendMessageSuccess = "ERROR");

export const fromConfig = jest.fn().mockImplementation(
  <T>(
    _config: ValidableKafkaProducerConfig,
    _topic: KafkaProducerTopicConfig<T>
  ): KafkaProducerCompact<T> => (): IKafkaProducerCompact<T> => ({
    producer: ({} as unknown) as Producer,
    topic: { topic: "TEST TOPIC" }
  })
);

export const sendMessages: <T>(
  fa: KafkaProducerCompact<T>
) => (
  messages: ReadonlyArray<T>
) => TE.TaskEither<
  ReadonlyArray<IStorableSendFailureError<T>>,
  ReadonlyArray<RecordMetadata>
> = _fa => ms =>
  sendMessageSuccess === "NOERROR"
    ? pipe(
        ms,
        RA.map(m => ({
          topicName: "TOPIC NAME",
          partition: 1,
          errorCode: 0
        })),
        TE.right
      )
    : pipe(
        ms,
        RA.map(m => ({
          message: "TEST MESSAGE",
          name: "NAME MESSAGE",
          retriable: false,
          body: m
        })),
        TE.left
      );
