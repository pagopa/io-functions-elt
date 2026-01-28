import * as t from "io-ts";

export type CommandImportServices = t.TypeOf<typeof CommandImportServices>;
export const CommandImportServices = t.interface({
  operation: t.literal("import-service")
});
