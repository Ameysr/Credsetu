/** A real 1x1 transparent PNG, used to exercise the receipt upload. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

export const TINY_PNG_FILENAME = 'receipt.png';

export const NOT_AN_IMAGE = Buffer.from('just some plain text, definitely not a photo');
