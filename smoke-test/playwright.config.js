module.exports = {
  testDir: '.',
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
};
