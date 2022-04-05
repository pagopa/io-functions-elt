import { Context } from "@azure/functions";

export const functionsContextMock = ({
  log: {
    error: jest.fn()
  }
} as unknown) as Context;
