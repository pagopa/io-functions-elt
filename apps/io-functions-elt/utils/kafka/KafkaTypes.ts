import { KafkaConfig, Message, ProducerConfig, ProducerRecord } from "kafkajs";

export type KafkaProducerCompactConfig<T> = KafkaProducerTopicConfig<T> &
  ValidableKafkaProducerConfig;

export type KafkaProducerTopicConfig<T> = Omit<ProducerRecord, "messages"> & {
  readonly messageFormatter?: MessageFormatter<T>;
};

export type MessageFormatter<T> = (message: T) => Message;

export type ValidableKafkaProducerConfig = KafkaConfig & ProducerConfig;
