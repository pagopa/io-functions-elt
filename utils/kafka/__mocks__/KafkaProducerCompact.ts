import {
  KafkaProducerCompact,
  IKafkaProducerCompact
} from "../KafkaProducerCompact";
import * as TE from "fp-ts/TaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import { IStorableSendFailureError } from "../KafkaOperation";
import { Producer, RecordMetadata } from "kafkajs";
import { pipe } from "fp-ts/lib/function";
import {
  ValidableKafkaProducerConfig,
  KafkaProducerTopicConfig
} from "../KafkaTypes";

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
