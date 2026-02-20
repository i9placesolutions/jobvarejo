#!/usr/bin/env node
/**
 * Script para testar a API de presigned URL do servidor Nuxt
 * Execute: node scripts/test-contabo-api.js
 * 
 * PRÉ-REQUISITO: Servidor Nuxt deve estar rodando (npm run dev)
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Carregar .env
config({ path: join(rootDir, '.env') })

const NUXT_URL = process.env.NUXT_URL || 'http://localhost:3000'

console.log('🔍 Testando API de presigned URL da Contabo...\n')
console.log('='.repeat(60))
console.log(`📡 Servidor: ${NUXT_URL}\n`)

// Teste 1: PUT (upload)
console.log('1️⃣ Testando presigned URL para PUT (upload)...\n')
try {
  const testKey = `test/api-test-${Date.now()}.json`
  const response = await fetch(`${NUXT_URL}/api/storage/presigned`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: testKey,
      contentType: 'application/json',
      operation: 'put'
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ Erro na API:', response.status, response.statusText)
    console.error('   Resposta:', errorText)
    process.exit(1)
  }

  const data = await response.json()
  if (!data?.url) {
    console.error('❌ API não retornou URL válida')
    console.error('   Resposta:', data)
    process.exit(1)
  }

  console.log('✅ Presigned URL gerada com sucesso!')
  console.log(`   URL: ${data.url.substring(0, 100)}...`)
  console.log(`   Bucket: ${data.bucket || 'N/A'}`)
  console.log(`   Region: ${data.region || 'N/A'}`)

  // Teste 2: Upload real
  console.log('\n2️⃣ Testando upload real com presigned URL...\n')
  const testContent = JSON.stringify({ 
    test: true, 
    timestamp: new Date().toISOString(),
    message: 'Teste de integração Contabo'
  })

  const uploadResponse = await fetch(data.url, {
    method: 'PUT',
    body: testContent,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (uploadResponse.ok) {
    console.log('✅ Upload realizado com sucesso!')
    console.log(`   Status: ${uploadResponse.status}`)
    
    // Teste 3: GET (download)
    console.log('\n3️⃣ Testando presigned URL para GET (download)...\n')
    const getResponse = await fetch(`${NUXT_URL}/api/storage/presigned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: testKey,
        operation: 'get'
      })
    })

    if (getResponse.ok) {
      const getData = await getResponse.json()
      if (getData?.url) {
        console.log('✅ Presigned URL GET gerada com sucesso!')
        
        // Teste 4: Download real
        console.log('\n4️⃣ Testando download real...\n')
        const downloadResponse = await fetch(getData.url)
        
        if (downloadResponse.ok) {
          const downloadedContent = await downloadResponse.json()
          console.log('✅ Download realizado com sucesso!')
          console.log(`   Conteúdo: ${JSON.stringify(downloadedContent)}`)
          
          console.log('\n' + '='.repeat(60))
          console.log('✅ INTEGRAÇÃO CONTABO FUNCIONANDO PERFEITAMENTE!')
          console.log('='.repeat(60))
          console.log('\n📝 A API está funcionando corretamente!')
          console.log('   O servidor Nuxt está gerando presigned URLs válidas')
          console.log('   Upload e download estão funcionando')
          console.log('\n')
        } else {
          console.error('❌ Erro no download:', downloadResponse.status, downloadResponse.statusText)
          process.exit(1)
        }
      } else {
        console.error('❌ API não retornou URL GET válida')
        process.exit(1)
      }
    } else {
      const errorText = await getResponse.text()
      console.error('❌ Erro ao gerar presigned URL GET:', getResponse.status)
      console.error('   Resposta:', errorText)
      process.exit(1)
    }
  } else {
    const errorText = await uploadResponse.text()
    console.error('❌ Erro no upload:', uploadResponse.status, uploadResponse.statusText)
    console.error('   Detalhes:', errorText)
    process.exit(1)
  }

} catch (error) {
  console.error('❌ Erro ao testar API:', error.message)
  if (error.code === 'ECONNREFUSED') {
    console.error('\n💡 Dica: Certifique-se de que o servidor Nuxt está rodando:')
    console.error('   npm run dev')
  }
  process.exit(1)
}
