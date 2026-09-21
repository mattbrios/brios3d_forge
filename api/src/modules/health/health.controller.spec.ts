import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

async function createController(query: () => Promise<unknown>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [HealthService, { provide: DataSource, useValue: { query } }],
  }).compile();
  return moduleRef.get(HealthController);
}

async function expectUnavailable(promise: Promise<unknown>) {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getStatus()).toBe(503);
  expect((error as HttpException).message).toBe('Database unavailable');
}

describe('HealthController', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('503 when the query fails', async () => {
    const controller = await createController(() =>
      Promise.reject(new Error('connection refused')),
    );
    await expectUnavailable(controller.check());
  });

  it('503 after 3000 ms without an answer, 200 when it answers at 2999 ms', async () => {
    vi.useFakeTimers();

    const hanging = await createController(() => new Promise(() => undefined));
    const hangingResult = hanging.check().catch((caught: unknown) => caught);
    await vi.advanceTimersByTimeAsync(3000);
    await expectUnavailable(hangingResult.then((value) => Promise.reject(value)));

    const slow = await createController(
      () => new Promise((resolve) => setTimeout(() => resolve([{}]), 2999)),
    );
    const slowResult = slow.check();
    await vi.advanceTimersByTimeAsync(3000);
    await expect(slowResult).resolves.toEqual({ status: 'ok' });
  });
});
