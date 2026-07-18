const TRUSTED_ORIGINS = new Set([
  'http://localhost:5173',
  'https://hotpulse-opportunity-radar.vercel.app',
]);

const VERCEL_PREVIEW_ORIGIN_PATTERN = /^https:\/\/hotpulse-opportunity-radar(?:-[a-z0-9]+)*-easyplay198-1375s-projects\.vercel\.app$/;

function parseConfiguredOrigins(value = '') {
  return new Set(String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean));
}

function isAllowedCorsOrigin(origin, configuredOrigins = new Set()) {
  if (!origin) return true;

  return TRUSTED_ORIGINS.has(origin)
    || VERCEL_PREVIEW_ORIGIN_PATTERN.test(origin)
    || configuredOrigins.has(origin);
}

function createCorsOriginValidator(configuredOriginValue = '') {
  const configuredOrigins = parseConfiguredOrigins(configuredOriginValue);

  return function validateCorsOrigin(origin, callback) {
    if (isAllowedCorsOrigin(origin, configuredOrigins)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  };
}

export {
  VERCEL_PREVIEW_ORIGIN_PATTERN,
  createCorsOriginValidator,
  isAllowedCorsOrigin,
  parseConfiguredOrigins,
};
