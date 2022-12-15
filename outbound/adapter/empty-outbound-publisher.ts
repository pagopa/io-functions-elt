import { flow } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as RA from "fp-ts/ReadonlyArray";
import { OutboundPublisher, success } from "../port/outbound-publisher";

export const create = <T>(): OutboundPublisher<T> => ({
  publish: TE.right,
  publishes: flow(RA.map(success), T.of)
});
