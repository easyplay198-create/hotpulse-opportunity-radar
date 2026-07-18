import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { app } from '../index.js';
import {
  createCorsOriginValidator,
  isAllowedCorsOrigin,
  parseConfiguredOrigins,
} from '../corsPolicy.js';

const PRODUCTION_ORIGIN = 'https://hotpulse-opportunity-radar.vercel.app';
const PREVIEW_ORIGIN = 'https://hotpulse-opportunity-radar-git-fix-cors-easyplay198-1375s-projects.vercel.app';

async function withServer(run) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('allows the local Vite development origin', () => {
  assert.equal(isAllowedCorsOrigin('http://localhost:5173'), true);
});

test('allows the production Vercel origin', () => {
  assert.equal(isAllowedCorsOrigin(PRODUCTION_ORIGIN), true);
});

test('allows project-scoped Vercel Preview origins', () => {
  assert.equal(isAllowedCorsOrigin(PREVIEW_ORIGIN), true);
});

test('allows requests without an Origin header', () => {
  assert.equal(isAllowedCorsOrigin(undefined), true);
});

test('rejects Preview origins for unrelated Vercel projects', () => {
  assert.equal(isAllowedCorsOrigin('https://another-project-git-main-easyplay198-1375s-projects.vercel.app'), false);
});

test('rejects domains that append an evil suffix', () => {
  assert.equal(isAllowedCorsOrigin(`${PREVIEW_ORIGIN}.evil.com`), false);
});

test('preserves comma-separated CLIENT_ORIGIN compatibility', () => {
  const configuredOrigins = parseConfiguredOrigins('https://configured.example, https://second.example');
  assert.equal(isAllowedCorsOrigin('https://configured.example', configuredOrigins), true);
  assert.equal(isAllowedCorsOrigin('https://second.example', configuredOrigins), true);
});

test('validator rejects an arbitrary Origin instead of reflecting it', async () => {
  const validateOrigin = createCorsOriginValidator('');
  await new Promise((resolve, reject) => {
    validateOrigin('https://evil.example', (error, allowed) => {
      try {
        assert.match(error?.message || '', /Not allowed by CORS/);
        assert.equal(allowed, undefined);
        resolve();
      } catch (assertionError) {
        reject(assertionError);
      }
    });
  });
});

test('/api/opportunities returns the matching CORS header for a valid Preview Origin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/opportunities`, {
      headers: { Origin: PREVIEW_ORIGIN },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), PREVIEW_ORIGIN);
    assert.notEqual(response.headers.get('access-control-allow-origin'), '*');
  });
});

test('/api/opportunities remains accessible without an Origin header', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/opportunities`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });
});

test('OPTIONS preflight succeeds for a valid Preview Origin', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/opportunities`, {
      method: 'OPTIONS',
      headers: {
        Origin: PREVIEW_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), PREVIEW_ORIGIN);
    assert.equal(response.headers.get('access-control-allow-credentials'), null);
  });
});
