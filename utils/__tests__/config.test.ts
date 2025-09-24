import {
  nestifyPrefixedType,
  getKafkaProducerCompactConfigFromEnv
} from "../config";
import * as E from "fp-ts/Either";
import { TestUsersArrayDecoder } from "../testUser";
import { gzipSync } from "zlib";

const dummyEnvWithoutSASL = {
  OTHERS: "others env properties",
  TARGETKAFKA_clientId: "IO_FUNCTIONS_ELT",
  TARGETKAFKA_brokers: "localhost:9093",
  TARGETKAFKA_ssl: "true",
  TARGETKAFKA_maxInFlightRequests: "1",
  TARGETKAFKA_idempotent: "true",
  TARGETKAFKA_transactionalId: "IO_ELT",
  TARGETKAFKA_topic: "io-cosmosdb-services"
};

const dummyEnv = {
  ...dummyEnvWithoutSASL,
  TARGETKAFKA_sasl_mechanism: "plain",
  TARGETKAFKA_sasl_username: "username",
  TARGETKAFKA_sasl_password: "password"
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

const dummyTargetKafkaConfigWithoutSASL = {
  brokers: ["localhost:9093"],
  clientId: "IO_FUNCTIONS_ELT",
  idempotent: true,
  maxInFlightRequests: 1,
  ssl: true,
  transactionalId: "IO_ELT",
  topic: "io-cosmosdb-services"
};

const dummyTargetKafkaConfig = {
  ...dummyTargetKafkaConfigWithoutSASL,
  sasl: {
    mechanism: "plain",
    password: "password",
    username: "username"
  }
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
    const aaa =
      getKafkaProducerCompactConfigFromEnv("TARGETKAFKA").decode(dummyEnv);
    expect(E.isRight(aaa)).toBeTruthy();
    if (E.isRight(aaa)) {
      expect(E.getOrElseW(() => "")(aaa)).toStrictEqual(dummyTargetKafkaConfig);
    }
  });

  it("GIVEN a valid kafka producer configuration WHEN is without SASL params THEN a right either is returned", () => {
    const aaa =
      getKafkaProducerCompactConfigFromEnv("TARGETKAFKA").decode(
        dummyEnvWithoutSASL
      );
    expect(E.isRight(aaa)).toBeTruthy();
    if (E.isRight(aaa)) {
      expect(E.getOrElseW(() => "")(aaa)).toStrictEqual(
        dummyTargetKafkaConfigWithoutSASL
      );
    }
  });

  it("GIVEN a valid fiscalcodes list as base64 of a gzipped string WHEN the decode is called THEN a right either is returned", () => {
    const someFiscalCodes = [
      "AAAAAA00A00A000B",
      "AAAAAA00A00A000C",
      "ISPXNB32R82Y766D"
    ];
    const newBase64 = gzipSync(someFiscalCodes.join(",")).toString("base64");

    const res = TestUsersArrayDecoder.decode(newBase64);
    expect(E.isRight(res)).toBeTruthy();
  });
});
