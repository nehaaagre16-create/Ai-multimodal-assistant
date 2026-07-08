import { test, expect } from '../run-tests.js'

test('chat page renders main interface', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/chat`)
  await page.waitForLoadState('networkidle')

  // Sidebar
  const sidebar = await page.$('text=Nexus AI')
  expect(sidebar).toBeTruthy()

  // Conversation header
  const header = await page.$('text=Live Conversation')
  expect(header).toBeTruthy()

  // Chat label
  const chatLabel = await page.$('text=Chat')
  expect(chatLabel).toBeTruthy()

  // Chat input
  const input = await page.$('input[placeholder="Type a message..."]')
  expect(input).toBeTruthy()
})

test('chat page main content has non-zero size', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/chat`)
  await page.waitForLoadState('networkidle')

  const rect = await page.evaluate(() => {
    const main = document.querySelector('main, .main-content')
    if (!main) return null
    const r = main.getBoundingClientRect()
    return { width: r.width, height: r.height }
  })

  expect(rect).toBeTruthy()
  expect(rect.width).toBeGreaterThan(0)
  expect(rect.height).toBeGreaterThan(0)
})

test('sending a message adds it to the chat', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/chat`)
  await page.waitForLoadState('networkidle')

  const testMessage = 'Hello from Playwright test ' + Date.now()
  await page.fill('input[placeholder="Type a message..."]', testMessage)
  await page.press('input[placeholder="Type a message..."]', 'Enter')

  // Wait for message to appear
  await page.waitForSelector(`text=${testMessage}`, { timeout: 5000 })
  const message = await page.$(`text=${testMessage}`)
  expect(message).toBeTruthy()
})
