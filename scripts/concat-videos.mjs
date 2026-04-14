#!/usr/bin/env node

/**
 * Concatenates per-test Playwright videos into a single showcase MP4.
 *
 * Reads test-results/report.json (Playwright JSON reporter output) for
 * test ordering and video paths, then uses ffmpeg to produce showcase.mp4.
 *
 * Usage: node scripts/concat-videos.mjs
 */

import { execFileSync, execSync } from 'child_process'
import { existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const RESULTS_DIR = path.join(ROOT, 'test-results')
const REPORT_PATH = path.join(RESULTS_DIR, 'report.json')
const OUTPUT_PATH = path.join(ROOT, 'showcase.mp4')

const PROJECT_ORDER = ['app', 'dialogs', 'menus', 'navigation']

// ---------------------------------------------------------------------------
// 1. Parse the JSON report and collect video paths in order
// ---------------------------------------------------------------------------

function collectTests(suite, titlePath = []) {
  const results = []
  const currentPath = suite.title ? [...titlePath, suite.title] : titlePath

  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      for (const result of test.results) {
        const videoAttachment = result.attachments?.find((a) => a.name === 'video')
        if (videoAttachment?.path) {
          results.push({
            titlePath: [...currentPath, spec.title],
            projectName: test.projectName,
            videoPath: videoAttachment.path,
          })
        }
      }
    }
  }

  for (const child of suite.suites ?? []) {
    results.push(...collectTests(child, currentPath))
  }

  return results
}

// ---------------------------------------------------------------------------
// 2. Main
// ---------------------------------------------------------------------------

function main() {
  // Check prerequisites
  if (!existsSync(REPORT_PATH)) {
    console.error(`JSON report not found at ${REPORT_PATH}`)
    console.error('Run tests first: npx playwright test')
    process.exit(1)
  }

  try {
    execSync('which ffmpeg', { stdio: 'ignore' })
  } catch {
    console.error('ffmpeg not found. Install it: brew install ffmpeg')
    process.exit(1)
  }

  const report = JSON.parse(readFileSync(REPORT_PATH, 'utf-8'))

  // Collect all test videos
  const allTests = report.suites.flatMap((s) => collectTests(s))

  // Sort by project order (preserving within-project order from report)
  allTests.sort((a, b) => {
    const aIdx = PROJECT_ORDER.indexOf(a.projectName)
    const bIdx = PROJECT_ORDER.indexOf(b.projectName)
    return aIdx - bIdx
  })

  // Filter to only tests with existing video files
  const validTests = allTests.filter((t) => {
    const absPath = path.isAbsolute(t.videoPath) ? t.videoPath : path.resolve(ROOT, t.videoPath)
    return existsSync(absPath)
  })

  console.log(`Found ${validTests.length} test videos`)

  if (validTests.length === 0) {
    console.error('No video files found. Ensure tests ran with video: "on"')
    process.exit(1)
  }

  // Generate intro title card (3 seconds) as WebM to match test videos
  const introPath = path.join(RESULTS_DIR, '_intro.webm')
  const dateStr = new Date().toISOString().split('T')[0]
  const introText = `Lotta Chess Pairer - E2E Test Suite\\n${dateStr}  -  ${validTests.length} tests`

  console.log('Generating intro title card...')
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=0x1a1a2e:s=800x450:d=3:r=25',
      '-vf',
      `drawtext=text='${introText}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2`,
      '-c:v',
      'libvpx',
      '-b:v',
      '1M',
      '-pix_fmt',
      'yuv420p',
      introPath,
    ],
    { stdio: 'pipe' },
  )

  // Write concat list file
  const concatPath = path.join(RESULTS_DIR, '_concat.txt')
  const lines = [`file '${introPath}'`]
  for (const t of validTests) {
    const absPath = path.isAbsolute(t.videoPath) ? t.videoPath : path.resolve(ROOT, t.videoPath)
    lines.push(`file '${absPath}'`)
  }
  writeFileSync(concatPath, lines.join('\n'))

  // Concatenate all videos
  console.log(`Concatenating ${validTests.length + 1} clips into showcase.mp4...`)
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatPath,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      OUTPUT_PATH,
    ],
    { stdio: 'inherit' },
  )

  // Cleanup temp files
  unlinkSync(concatPath)
  unlinkSync(introPath)

  // Report file size
  const { size } = statSync(OUTPUT_PATH)
  const sizeMB = (size / (1024 * 1024)).toFixed(1)
  console.log(`\nShowcase video created: ${OUTPUT_PATH} (${sizeMB} MB)`)
}

main()
