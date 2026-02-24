#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const cwd = process.cwd()

const parseArgs = () => {
  const out = {
    profile: 'core',
    quiet: false
  }

  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith('--profile=')) {
      out.profile = String(raw.split('=')[1] || 'core').trim().toLowerCase()
      continue
    }
    if (raw === '--quiet') {
      out.quiet = true
    }
  }

  if (!['core', 'full'].includes(out.profile)) out.profile = 'core'
  return out
}

const parseEnvFile = (filename) => {
  const file = path.join(cwd, filename)
  if (!fs.existsSync(file)) return {}

  const raw = fs.readFileSync(file, 'utf8')
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const readMergedEnv = () => {
  const fromDotEnv = parseEnvFile('.env')
  const fromDotEnvLocal = parseEnvFile('.env.local')
  return {
    ...fromDotEnv,
    ...fromDotEnvLocal,
    ...process.env
  }
}

const hasValue = (env, key) => {
  const value = env[key]
  if (value == null) return false
  return String(value).trim().length > 0
}

const hasAny = (env, keys) => keys.some((key) => hasValue(env, key))

const hasAppBaseUrlLikeValue = (env) =>
  hasAny(env, [
    'APP_BASE_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
    'VERCEL_URL',
    'URL'
  ])

const fail = (lines) => {
  for (const line of lines) console.error(line)
  process.exit(1)
}

const run = () => {
  const args = parseArgs()
  const env = readMergedEnv()

  const missing = []
  const warnings = []

  const coreRequired = [
    'POSTGRES_DATABASE_URL',
    'AUTH_JWT_SECRET',
    'WASABI_ENDPOINT',
    'WASABI_BUCKET',
    'WASABI_ACCESS_KEY',
    'WASABI_SECRET_KEY',
    'WASABI_REGION'
  ]

  for (const key of coreRequired) {
    if (!hasValue(env, key)) missing.push(key)
  }

  if (!hasAny(env, ['NUXT_OPENAI_API_KEY', 'OPENAI_API_KEY'])) {
    missing.push('NUXT_OPENAI_API_KEY|OPENAI_API_KEY')
  }

  if (args.profile === 'full') {
    const fullRequired = [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_SECURE',
      'SMTP_USER',
      'SMTP_PASS',
      'SMTP_FROM'
    ]
    for (const key of fullRequired) {
      if (!hasValue(env, key)) missing.push(key)
    }

    if (!hasAppBaseUrlLikeValue(env)) {
      missing.push('APP_BASE_URL|VERCEL_PROJECT_PRODUCTION_URL|VERCEL_URL|URL')
    }

    const hasCseKey = hasAny(env, ['NUXT_GOOGLE_CSE_API_KEY', 'GOOGLE_CSE_API_KEY'])
    const hasCseCx = hasAny(env, ['NUXT_GOOGLE_CSE_CX', 'GOOGLE_CSE_CX'])
    const hasSerperKey = hasAny(env, ['NUXT_SERPER_API_KEY', 'SERPER_API_KEY'])
    if (!(hasSerperKey || (hasCseKey && hasCseCx))) {
      missing.push('(NUXT_GOOGLE_CSE_API_KEY|GOOGLE_CSE_API_KEY + NUXT_GOOGLE_CSE_CX|GOOGLE_CSE_CX) OR (NUXT_SERPER_API_KEY|SERPER_API_KEY)')
    }
  } else {
    const hasCseKey = hasAny(env, ['NUXT_GOOGLE_CSE_API_KEY', 'GOOGLE_CSE_API_KEY'])
    const hasCseCx = hasAny(env, ['NUXT_GOOGLE_CSE_CX', 'GOOGLE_CSE_CX'])
    const hasSerperKey = hasAny(env, ['NUXT_SERPER_API_KEY', 'SERPER_API_KEY'])
    if (!hasSerperKey && !hasCseKey) {
      warnings.push('NUXT_GOOGLE_CSE_API_KEY|GOOGLE_CSE_API_KEY or NUXT_SERPER_API_KEY|SERPER_API_KEY (features de busca externa)')
    }
    if (hasCseKey && !hasCseCx) {
      warnings.push('NUXT_GOOGLE_CSE_CX|GOOGLE_CSE_CX (search engine id do Google Custom Search)')
    }
    if (!hasAppBaseUrlLikeValue(env)) {
      warnings.push('APP_BASE_URL|VERCEL_PROJECT_PRODUCTION_URL|VERCEL_URL|URL (links corretos em e-mail de recuperação)')
    }
  }

  if (missing.length > 0) {
    const modeLabel = args.profile.toUpperCase()
    fail([
      `\n[env-check] Missing required environment variables (${modeLabel}):`,
      ...missing.map((key) => `- ${key}`),
      '\nCrie/atualize o arquivo .env a partir de .env.example e tente novamente.',
      'Exemplo: cp .env.example .env',
      ''
    ])
  }

  if (!args.quiet && warnings.length > 0) {
    console.warn('\n[env-check] Optional but recommended variables not set:')
    for (const warning of warnings) console.warn(`- ${warning}`)
    console.warn('')
  }

  if (!args.quiet) {
    console.log(`[env-check] OK (${args.profile})`)
  }
}

run()
