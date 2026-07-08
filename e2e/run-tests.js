import playwright from '/usr/local/lib/hermes-agent/node_modules/playwright/index.js'
import { readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const { chromium } = playwright

const __dirname = dirname(fileURLToPath(import.meta.url))

const BASE_URL = process.env.BASE_URL || 'http://172.30.77.104:5173'
const HEADLESS = process.env.HEADLESS !== 'false'
const WIDTH = 1280
const HEIGHT = 720

let browser
let context
let page

const tests = []

export function test(name, fn) {
  tests.push({ name, fn })
}

export function expect(actual) {
  return {
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy but got ${actual}`)
    },
    toBe(expected) {
      if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`)
    },
    toContain(substr) {
      if (typeof actual !== 'string' || !actual.includes(substr)) {
        throw new Error(`Expected string to contain ${substr}, got: ${actual}`)
      }
    },
    toBeGreaterThan(n) {
      if (typeof actual !== 'number' || actual <= n) {
        throw new Error(`Expected value greater than ${n}, got: ${actual}`)
      }
    }
  }
}

async function runTest(t) {
  try {
    await t.fn({ page, browser, context, baseUrl: BASE_URL })
    console.log(`✅ ${t.name}`)
    return true
  } catch (err) {
    console.log(`❌ ${t.name}`)
    console.log('   ', err.message)
    return false
  }
}

async function main() {
  console.log('Launching browser...')
  browser = await chromium.launch({ headless: HEADLESS, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } })
  page = await context.newPage()
  page.on('console', msg => console.log(`[console] ${msg.type()}: ${msg.text()}`))
  page.on('pageerror', err => console.log(`[pageerror] ${err.message}`))

  // Discover and import test files
  const files = readdirSync(join(__dirname, 'tests')).filter(f => f.endsWith('.spec.js'))
  for (const file of files) {
    console.log(`\nLoading ${file}...`)
    await import(join(__dirname, 'tests', file))
  }

  console.log(`\nRunning ${tests.length} tests...`)
  let passed = 0
  let failed = 0
  for (const t of tests) {
    const ok = await runTest(t)
    ok ? passed++ : failed++
  }

  await context.close()
  await browser.close()

  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
