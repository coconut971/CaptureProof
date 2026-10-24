import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://localhost:5080', trace: 'retain-on-failure' },
  reporter: [['list']],
  webServer: {
    command: 'dotnet run --no-launch-profile --project src/CaptureProof.Api --artifacts-path .data/e2e-build',
    url: 'http://localhost:5080/api/health', reuseExistingServer: !process.env.CI,
    env: { ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: 'http://localhost:5080', CaptureProof__DataDirectory: resolve('.data/e2e'), CaptureProof__MaxRequestsPerMinute: '1000' },
    timeout: 120000
  }
});
