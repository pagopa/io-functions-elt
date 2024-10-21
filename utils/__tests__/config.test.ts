import {
  nestifyPrefixedType,
  getKafkaProducerCompactConfigFromEnv
} from "../config";
import * as E from "fp-ts/Either";

const dummyEnv = {
  OTHERS: "others env properties",
  TARGETKAFKA_clientId: "IO_FUNCTIONS_ELT",
  TARGETKAFKA_brokers: "localhost:9093",
  TARGETKAFKA_ssl: "true",
  TARGETKAFKA_sasl_mechanism: "plain",
  TARGETKAFKA_sasl_username: "username",
  TARGETKAFKA_sasl_password: "password",
  TARGETKAFKA_maxInFlightRequests: "1",
  TARGETKAFKA_idempotent: "true",
  TARGETKAFKA_transactionalId: "IO_ELT",
  TARGETKAFKA_topic: "io-cosmosdb-services"
};

const dummyNestedEnv = {
  brokers: "localhost:9093",
  clientId: "IO_FUNCTIONS_ELT",
  idempotent: "true",
  maxInFlightRequests: "1",
  sasl: {
    mechanism: "plain",
    password: "password",
    username: "username"
  },
  ssl: "true",
  transactionalId: "IO_ELT",
  topic: "io-cosmosdb-services"
};

const dummyTargetKafkaConfig = {
  brokers: ["localhost:9093"],
  clientId: "IO_FUNCTIONS_ELT",
  idempotent: true,
  maxInFlightRequests: 1,
  sasl: {
    mechanism: "plain",
    password: "password",
    username: "username"
  },
  ssl: true,
  transactionalId: "IO_ELT",
  topic: "io-cosmosdb-services"
};

describe("config", () => {
  it("GIVEN an env containing also properties in the format TARGETKAFKA_<field_path> WHEN nestifyPrefixedType is called THEN an object with <field_path> as nested field is returned", () => {
    const processed = nestifyPrefixedType(dummyEnv, "TARGETKAFKA");
    expect(processed).toStrictEqual(dummyNestedEnv);
  });

  it("GIVEN a not valid kafka producer configuration WHEN the decode is called THEN a left either is returned", () => {
    const aaa = getKafkaProducerCompactConfigFromEnv("TARGETKAFKA").decode({
      ...dummyEnv,
      TARGETKAFKA_clientId: 1
    });
    expect(E.isLeft(aaa)).toBeTruthy();
  });

  it("GIVEN a valid kafka producer configuration WHEN the decode is called THEN a right either is returned", () => {
    const aaa = getKafkaProducerCompactConfigFromEnv("TARGETKAFKA").decode(
      dummyEnv
    );
    expect(E.isRight(aaa)).toBeTruthy();
    if (E.isRight(aaa)) {
      expect(E.getOrElseW(() => "")(aaa)).toStrictEqual(dummyTargetKafkaConfig);
    }
  });
});
