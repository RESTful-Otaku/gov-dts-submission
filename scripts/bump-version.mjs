#!/usr/bin/env node
/**
 * Bump repo semver (VERSION), sync frontend/package.json, backend/openapi.yaml,
 * Android versionName/versionCode, iOS MARKETING_VERSION / CURRENT_PROJECT_VERSION.
 * Usage: node scripts/bump-version.mjs major|minor|patch
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const kind = process.argv[2]
if (!['major', 'minor', 'patch'].includes(kind)) {
  console.error('Usage: node scripts/bump-version.mjs major|minor|patch')
  process.exit(1)
}

const versionPath = path.join(ROOT, 'VERSION')
const cur = fs.readFileSync(versionPath, 'utf8').trim()
const parts = cur.split('.').map((s) => parseInt(s, 10))
if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
  console.error(`Invalid VERSION: ${cur}`)
  process.exit(1)
}
let [maj, min, pat] = parts
if (kind === 'major') {
  maj += 1
  min = 0
  pat = 0
} else if (kind === 'minor') {
  min += 1
  pat = 0
} else {
  pat += 1
}
const next = `${maj}.${min}.${pat}`

const pkgPath = path.join(ROOT, 'frontend', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
pkg.version = next
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

const openapiPath = path.join(ROOT, 'backend', 'openapi.yaml')
let openapi = fs.readFileSync(openapiPath, 'utf8')
if (!/^  version: .+$/m.test(openapi)) {
  console.error('Could not find "  version:" in openapi.yaml')
  process.exit(1)
}
openapi = openapi.replace(/^  version: .+$/m, `  version: ${next}`)
fs.writeFileSync(openapiPath, openapi)

const gradlePath = path.join(ROOT, 'frontend', 'android', 'app', 'build.gradle')
let gradle = fs.readFileSync(gradlePath, 'utf8')
const vcMatch = gradle.match(/versionCode\s+(\d+)/)
if (!vcMatch) {
  console.error('Could not find versionCode in build.gradle')
  process.exit(1)
}
const nextCode = parseInt(vcMatch[1], 10) + 1
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`)
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${next}"`)
fs.writeFileSync(gradlePath, gradle)

const pbxPath = path.join(
  ROOT,
  'frontend',
  'ios',
  'App',
  'App.xcodeproj',
  'project.pbxproj',
)
let pbx = fs.readFileSync(pbxPath, 'utf8')
const cpMatch = pbx.match(/CURRENT_PROJECT_VERSION = (\d+);/)
if (!cpMatch) {
  console.error('Could not find CURRENT_PROJECT_VERSION in project.pbxproj')
  process.exit(1)
}
const nextIosBuild = parseInt(cpMatch[1], 10) + 1
pbx = pbx.replace(/MARKETING_VERSION = [0-9.]+;/g, `MARKETING_VERSION = ${next};`)
pbx = pbx.replace(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${nextIosBuild};`)
fs.writeFileSync(pbxPath, pbx)

fs.writeFileSync(versionPath, `${next}\n`)

console.log(next)
