import { roundCost, roundPriceUp } from './rounding.js';

describe('rounding', () => {
  it('cost rounds half up', () => {
    expect(roundCost(346.5)).toBe(347);
    expect(roundCost(346.49)).toBe(346);
  });

  it('price rounds up tolerating float noise', () => {
    expect(roundPriceUp(10000.000000000002)).toBe(10000);
    expect(roundPriceUp(10000.01)).toBe(10001);
  });
});
