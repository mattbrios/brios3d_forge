import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { PrintProfileError } from './print-profile.error.js';
import { PrintProfilesController } from './print-profiles.controller.js';
import type { PrintProfilesService } from './print-profiles.service.js';

function controllerThrowing(error: unknown): PrintProfilesController {
  const service = {
    importFromUrl: () => Promise.reject(error),
  } as unknown as PrintProfilesService;
  return new PrintProfilesController(service);
}

describe('PrintProfilesController', () => {
  it('maps domain errors to http', async () => {
    const cases = [
      { status: 400, type: BadRequestException },
      { status: 404, type: NotFoundException },
      { status: 502, type: BadGatewayException },
    ] as const;
    for (const { status, type } of cases) {
      const controller = controllerThrowing(new PrintProfileError(status, `erro ${status}`));
      const thrown = await controller.import({ url: 'x' }).catch((error: unknown) => error);
      expect(thrown, String(status)).toBeInstanceOf(type);
      expect((thrown as HttpException).getStatus()).toBe(status);
      expect((thrown as HttpException).message).toBe(`erro ${status}`);
    }
  });

  it('other errors are not converted', async () => {
    const boom = new Error('boom');
    await expect(controllerThrowing(boom).import({ url: 'x' })).rejects.toBe(boom);
  });
});
