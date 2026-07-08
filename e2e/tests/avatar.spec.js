import { test, expect } from '../run-tests.js'

test('avatar panel is present and portrait loads', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/chat`)
  await page.waitForLoadState('networkidle')

  // Wait for portrait image to load
  await page.waitForFunction(() => {
    const img = document.querySelector('.ai-panel img, img[alt="Avatar portrait"]')
    return img && img.naturalWidth > 0
  }, { timeout: 10000 })

  const width = await page.evaluate(() => {
    const img = document.querySelector('.ai-panel img, img[alt="Avatar portrait"]')
    return img ? img.naturalWidth : 0
  })

  expect(width).toBeGreaterThan(0)
})

test('avatar can generate video when speaking', async ({ page, baseUrl }) => {
  await page.goto(`${baseUrl}/chat`)
  await page.waitForLoadState('networkidle')

  // Trigger avatar speech through the exposed adapter
  await page.evaluate(() => {
    import('/src/components/Avatar/adapters/SpeechSynthesisAdapter.js').then(m => {
      const SpeechSynthesisAdapter = m.default
      SpeechSynthesisAdapter.speak('Test avatar speech from Playwright.')
    })
  })

  // Wait for a video element to appear
  await page.waitForFunction(() => {
    return document.querySelectorAll('video').length > 0
  }, { timeout: 30000 })

  const videoCount = await page.evaluate(() => document.querySelectorAll('video').length)
  expect(videoCount).toBeGreaterThan(0)
})
