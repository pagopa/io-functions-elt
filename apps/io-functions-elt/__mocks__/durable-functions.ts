import { vi } from "vitest";

export const mockStartNew = vi.fn();

export const getClient = vi.fn(() => ({
  startNew: mockStartNew
}));

export const orchestrator = vi.fn();

export const RetryOptions = vi.fn(() => ({}));
