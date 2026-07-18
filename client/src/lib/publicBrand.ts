const PUBLIC_BRAND_REPLACEMENTS: Array<[RegExp, string]> = [
  [/HotPulse Market Knowledge/gi, 'PRAXON Market Knowledge'],
  [/HotPulse First-Party Knowledge Core/gi, 'PRAXON First-Party Knowledge Core'],
  [/万道出海/g, '派克森商机雷达'],
  [/万道/g, '派克森'],
  [/HotPulse/gi, 'PRAXON'],
];

export function toPublicBrandText(value: string): string {
  return PUBLIC_BRAND_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}
