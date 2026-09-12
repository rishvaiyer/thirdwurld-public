
import { readdir, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const sourceRoots = ['src', 'test']
const extraTextFiles = ['README.md', 'package.json']
const findings = []

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await filesBelow(candidate)))
    else if (entry.isFile()) files.push(candidate)
  }
  return files
}

const sourceFiles = (await Promise.all(sourceRoots.map(filesBelow))).flat().sort()
for (const file of sourceFiles.filter(file => file.endsWith('.js'))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
  if (result.status !== 0) findings.push(`${file}: invalid JavaScript syntax`)
}

const checks = [
  ['absolute local path', /(?:\/Users\/|[A-Z]:\\Users\\)/],
  ['environment access', /process\.env/],
  ['embedded URL', /https?:\/\//],
  ['secret-shaped term', /\b(?:api[_ -]?key|password|secret|token|webhook)\b/i],
  ['unfinished note', /\b(?:TODO|FIXME|HACK|XXX)\b/],
  ['internal agent reference', /\b(?:Codex|Claude)\b/],
  ['long dash character', /[—–]/],
]

for (const file of [...sourceFiles, ...extraTextFiles]) {
  const content = await readFile(file, 'utf8')
  for (const [label, pattern] of checks) {
    if (pattern.test(content)) findings.push(`${file}: ${label}`)
  }
}

if (findings.length) {
  process.stderr.write(`${findings.join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`repository guard passed for ${sourceFiles.length + extraTextFiles.length} public files\n`)
}

