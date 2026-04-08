import { test, expect } from '@playwright/test';

/**
 * Server startup tests for MMGIS.
 *
 * Validates that the application server starts correctly and its
 * healthcheck endpoint responds as expected.
 */

test.describe('MMGIS Server Startup', () => {

  test('GET /api/utils/healthcheck returns 200', async ({ request }) => {
    const response = await request.get('/api/utils/healthcheck');
    expect(response.status()).toBe(200);
  });

  test('healthcheck response contains success indicator', async ({ request }) => {
    const response = await request.get('/api/utils/healthcheck');
    const body = await response.text();

    // When AUTH=off the endpoint returns "Alive and Well!".
    // When AUTH=local the server redirects unauthenticated requests to the
    // login page, so receiving the login HTML still proves the server is up.
    const isAlive = body.includes('Alive');
    const isLoginPage = body.includes('MMGIS') && body.includes('Login');
    expect(isAlive || isLoginPage).toBeTruthy();
  });

  test('no critical errors in server startup', async ({ request }) => {
    // Verify the server can serve the main page without a 500-level error.
    const response = await request.get('/');
    expect(response.status()).toBeLessThan(500);
  });
});
