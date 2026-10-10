/** Round to 2 decimal places for currency and quantities. */
export const roundTo2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
