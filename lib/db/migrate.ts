#!/usr/bin/env node
// Run DB migrations against Neon Postgres
// Usage: bun run db:migrate
// Requires: DATABASE_URL in .env.local

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { neon } from '@neondatabase/serverless'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local manually for this script
try {
  const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  // .env.local not found — rely on environment variables
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

function splitSqlStatements(content: string): string[] {
  const statements: string[] = []
  let current = ''
  let dollarQuoteTag: string | null = null

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    current += char

    if (char === '$') {
      const match = content.slice(i).match(/^\$[A-Za-z0-9_]*\$/)
      if (match) {
        const tag = match[0]
        current += content.slice(i + 1, i + tag.length)
        i += tag.length - 1
        dollarQuoteTag = dollarQuoteTag === tag ? null : tag
        continue
      }
    }

    if (char === ';' && !dollarQuoteTag) {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ''
    }
  }

  const tail = current.trim()
  if (tail) statements.push(tail)
  return statements
}

async function main() {

// Run in correct order (003 before 002 — collections before prompts)
const MIGRATION_ORDER = [
  '001_profiles.sql',
  '003_collections.sql',
  '002_prompts.sql',
  '004_public_prompts.sql',
  '005_sync_operations.sql',
  '006_templates.sql',
  '007_public_prompt_cover.sql',
  '008_user_ai_keys.sql',
]

for (const filename of MIGRATION_ORDER) {
  const filePath = join(__dirname, 'migrations', filename)
  const content = readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  console.log(`Running: ${filename}`)
  // Execute each SQL statement separately (neon() doesn't support multi-statement)
  const statements = splitSqlStatements(content)

  for (const stmt of statements) {
    await sql(stmt)
  }
  console.log(`  ✓ ${filename}`)
}

console.log('\nAll migrations applied successfully.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
