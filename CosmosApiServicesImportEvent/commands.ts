import * as t from "io-ts";

export type CommandImportServices = t.TypeOf<typeof CommandImportServices>;
export const CommandImportServices = t.interface({
  operation: t.literal("import-service")
});

export type CommandMessageReport = t.TypeOf<typeof CommandMessageReport>;
export const CommandMessageReport = t.interface({
  operation: t.literal("process-message-report"),
  range_min: t.number,
  // eslint-disable-next-line sort-keys
  range_max: t.number
});
