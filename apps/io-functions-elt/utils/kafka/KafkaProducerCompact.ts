import * as IO from "fp-ts/IO";
import { flow } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { Kafka, Producer, RecordMetadata } from "kafkajs";

import { IStorableSendFailureError } from "./KafkaOperation";
import { send } from "./KafkaProducer";
import {
  KafkaProducerTopicConfig,
  ValidableKafkaProducerConfig
} from "./KafkaTypes";

export interface IKafkaProducerCompact<T> {
  readonly producer: Producer;
  readonly topic: KafkaProducerTopicConfig<T>;
}

/**
 * @category: model
 * @since: 1.0.0
 */
export type KafkaProducerCompact<T> = IO.IO<IKafkaProducerCompact<T>>;

/**
 * @param config input kafka brokers and target topic configuration
 * @category: constructor
 * @since: 1.0.0
 */
export const fromConfig =
  <T>(
    config: ValidableKafkaProducerConfig,
    topic: KafkaProducerTopicConfig<T>
  ): KafkaProducerCompact<T> =>
  (): IKafkaProducerCompact<T> => ({
    producer: new Kafka(config).producer(config),
    topic
  });

export const sendMessages: <T>(
  fa: KafkaProducerCompact<T>
) => (
  messages: readonly T[]
) => TE.TaskEither<
  readonly IStorableSendFailureError<T>[],
  readonly RecordMetadata[]
> = (fa) => flow((messages) => send(fa().topic, messages, () => fa().producer));
