import { vi } from "vitest";

export const mockStartNew = vi.fn();

export const getClient = vi.fn(() => ({
  startNew: mockStartNew
}));

export const app = {
  activity: vi.fn(),
  orchestration: vi.fn()
};

export const input = {
  durableClient: vi.fn(() => ({}))
};

export const RetryOptions = vi.fn(() => ({}));
