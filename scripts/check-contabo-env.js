#!/usr/bin/env node
/**
 * Script para verificar se as variáveis de ambiente da Contabo estão configuradas
 * Execute: node scripts/check-contabo-env.js
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Carregar .env manualmente
config({ path: join(rootDir, '.env') })

const requiredVars = [
  'CONTABO_ENDPOINT',
  'CONTABO_BUCKET',
  'CONTABO_ACCESS_KEY',
  'CONTABO_SECRET_KEY',
  'CONTABO_REGION'
]

console.log('🔍 Verificando variáveis de ambiente da Contabo...\n')

let allOk = true
const results = {}

requiredVars.forEach(varName => {
  const value = process.env[varName]
  const isSet = !!value
  results[varName] = { isSet, value: isSet ? (varName.includes('KEY') || varName.includes('SECRET') ? '***' + value.slice(-4) : value) : null }
  
  if (!isSet) {
    allOk = false
    console.log(`❌ ${varName}: NÃO DEFINIDA`)
  } else {
    console.log(`✅ ${varName}: ${results[varName].value}`)
  }
})

console.log('\n' + '='.repeat(60))

if (allOk) {
  console.log('✅ Todas as variáveis estão configuradas!')
  console.log('\n📝 Próximos passos:')
  console.log('   1. Reinicie o servidor Nuxt (npm run dev)')
  console.log('   2. Verifique os logs do servidor ao tentar salvar')
  console.log('   3. Se ainda houver erro, verifique as credenciais na Contabo')
} else {
  console.log('❌ Algumas variáveis estão faltando!')
  console.log('\n📝 Como corrigir:')
  console.log('   1. Edite o arquivo .env na raiz do projeto')
  console.log('   2. Adicione as variáveis faltantes:')
  requiredVars.forEach(v => {
    if (!results[v].isSet) {
      console.log(`      ${v}=seu-valor-aqui`)
    }
  })
  console.log('   3. Reinicie o servidor Nuxt')
}

console.log('\n' + '='.repeat(60))

process.exit(allOk ? 0 : 1)
