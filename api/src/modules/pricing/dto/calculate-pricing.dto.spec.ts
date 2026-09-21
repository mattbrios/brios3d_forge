import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { r1 } from '../fixtures/r1.js';
import { CalculatePricingDto } from './calculate-pricing.dto.js';

async function messagesOf(body: unknown): Promise<string[]> {
  const dto = plainToInstance(CalculatePricingDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  const collect = (list: typeof errors): string[] =>
    list.flatMap((error) => [
      ...Object.values(error.constraints ?? {}),
      ...collect(error.children ?? []),
    ]);
  return collect(errors);
}

describe('CalculatePricingDto', () => {
  it('accepts the R1 case', async () => {
    expect(await messagesOf(r1())).toEqual([]);
  });

  it('rejects rates at 1 with the field name', async () => {
    for (const field of ['marginRate', 'taxRate']) {
      const messages = await messagesOf({ ...r1(), [field]: 1 });
      expect(messages).toContain(`${field} must be less than 1`);
    }
    const body = r1();
    body.channels[0].feeRate = 1;
    expect(await messagesOf(body)).toContain('feeRate must be less than 1');
  });

  it('accepts a rate just below 1', async () => {
    expect(await messagesOf({ ...r1(), marginRate: 0.99 })).toEqual([]);
  });

  it('rejects zero divisors and non-integer quantity', async () => {
    const body = r1();
    body.printer.lifespanHours = 0;
    body.fixedCosts.productiveHoursPerMonth = 0;
    body.quantity = 1.5;
    const messages = await messagesOf(body);
    expect(messages).toContain('lifespanHours must be a positive number');
    expect(messages).toContain('productiveHoursPerMonth must be a positive number');
    expect(messages).toContain('quantity must be an integer number');
  });

  it('rejects undeclared nested properties', async () => {
    const body = { ...r1(), printer: { ...r1().printer, extra: true } };
    expect((await messagesOf(body)).join(';')).toContain('should not exist');
  });
});
