import { Context } from "@azure/functions";
import { QueueClient } from "@azure/storage-queue";
import { UserDataProcessingChoiceEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingChoice";
import { UserDataProcessingStatusEnum } from "@pagopa/io-functions-commons/dist/generated/definitions/UserDataProcessingStatus";
import { RetrievedUserDataProcessing } from "@pagopa/io-functions-commons/dist/src/models/user_data_processing";
import { FiscalCode } from "@pagopa/ts-commons/lib/strings";
import { Second } from "@pagopa/ts-commons/lib/units";

import { getAnalyticsProcessorForDocuments } from "../businesslogic/analytics-publish-documents";
import * as KA from "../outbound/adapter/kafka-outbound-publisher";
import * as PDVA from "../outbound/adapter/pdv-id-outbound-enricher";
import * as PF from "../outbound/adapter/predicate-outbound-filterer";
import * as QA from "../outbound/adapter/queue-outbound-mapper-publisher";
import * as TA from "../outbound/adapter/tracker-outbound-publisher";
import { OutboundEnricher } from "../outbound/port/outbound-enricher";
import { OutboundFilterer } from "../outbound/port/outbound-filterer";
import { OutboundPublisher } from "../outbound/port/outbound-publisher";
import { getConfigOrThrow, withTopic } from "../utils/config";
import { httpOrHttpsApiFetch } from "../utils/fetch";
import { profileDeletionAvroFormatter } from "../utils/formatter/deletesAvroFormatter";
import * as KP from "../utils/kafka/KafkaProducerCompact";
import { ValidableKafkaProducerConfig } from "../utils/kafka/KafkaTypes";
import { pdvTokenizerClient } from "../utils/pdvTokenizerClient";
import { createRedisClientSingleton } from "../utils/redis";
import { isTestUser } from "../utils/testUser";
import { RetrievedUserDataProcessingWithMaybePdvId } from "../utils/types/decoratedTypes";

const config = getConfigOrThrow();

const profileDeletionConfig = withTopic(
  config.deletesKafkaTopicConfig.DELETES_TOPIC_NAME,
  config.deletesKafkaTopicConfig.DELETES_TOPIC_CONNECTION_STRING
)(config.targetKafkaAuth);

const profileDeletionTopic = {
  ...profileDeletionConfig,
  messageFormatter: profileDeletionAvroFormatter()
};

const profileDeletionsOnKafkaAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> =
  KA.create(
    KP.fromConfig(
      profileDeletionConfig as ValidableKafkaProducerConfig, // cast due to wrong association between Promise<void> and t.Function ('brokers' field)
      profileDeletionTopic
    )
  );

const profileDeletionsOnQueueAdapter: OutboundPublisher<RetrievedUserDataProcessingWithMaybePdvId> =
  QA.create(
    (profileDeletion) => {
      // void storing userPDVId it in queue
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userPDVId, ...rest } = profileDeletion;
      return rest;
    },
    new QueueClient(
      config.INTERNAL_STORAGE_CONNECTION_STRING,
      config.DELETES_FAILURE_QUEUE_NAME
    )
  );

const pdvTokenizer = pdvTokenizerClient(
  config.PDV_TOKENIZER_BASE_URL,
  config.PDV_TOKENIZER_API_KEY,
  httpOrHttpsApiFetch,
  config.PDV_TOKENIZER_BASE_PATH
);

const telemetryClient = TA.initTelemetryClient(
  config.APPLICATIONINSIGHTS_CONNECTION_STRING
);

const redisClientTask = createRedisClientSingleton(config);

const pdvIdEnricherAdapter: OutboundEnricher<RetrievedUserDataProcessingWithMaybePdvId> =
  PDVA.create<RetrievedUserDataProcessingWithMaybePdvId>(
    config.ENRICH_PDVID_THROTTLING,
    pdvTokenizer,
    redisClientTask,
    config.PDV_IDS_TTL as Second,
    telemetryClient
  );

const telemetryAdapter = TA.create(telemetryClient);

const internalTestFiscalCodeSet = new Set(
  config.INTERNAL_TEST_FISCAL_CODES_COMPRESSED as readonly FiscalCode[]
);
const userDataProcessingFilterer: OutboundFilterer<RetrievedUserDataProcessing> =
  PF.create(
    (retrievedUserDataProcessing) =>
      !isTestUser(
        retrievedUserDataProcessing.fiscalCode,
        internalTestFiscalCodeSet
      ) &&
      retrievedUserDataProcessing.choice ===
        UserDataProcessingChoiceEnum.DELETE &&
      retrievedUserDataProcessing.status === UserDataProcessingStatusEnum.WIP
  );

const run = (_context: Context, documents: readonly unknown[]): Promise<void> =>
  getAnalyticsProcessorForDocuments(
    RetrievedUserDataProcessing,
    telemetryAdapter,
    pdvIdEnricherAdapter,
    profileDeletionsOnKafkaAdapter,
    profileDeletionsOnQueueAdapter,
    userDataProcessingFilterer
  ).process(documents)();

export default run;
