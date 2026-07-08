import { test, expect } from '../run-tests.js'

test('landing page has start chat button', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`)
  await page.waitForLoadState('networkidle')
  const button = await page.$('text=Start Chat')
  expect(button).toBeTruthy()
})

test('start chat navigates to /chat', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/`)
  await page.waitForLoadState('networkidle')
  await page.click('text=Start Chat')
  await page.waitForURL(`${baseUrl}/chat`)
  expect(page.url()).toBe(`${baseUrl}/chat`)
})
