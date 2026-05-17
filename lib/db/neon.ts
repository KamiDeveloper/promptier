// Neon Serverless connection — SERVER ONLY
// Never import this in Client Components or expose DATABASE_URL to client.
import { neon } from '@neondatabase/serverless'
import { neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Required for Node.js runtime (Vercel Serverless Functions)
neonConfig.webSocketConstructor = ws

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set.')
}

// One sql tag per request (recommended for serverless)
export const sql = neon(process.env.DATABASE_URL)
