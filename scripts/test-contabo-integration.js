#!/usr/bin/env node
/**
 * Script para testar a integração completa com Contabo Storage
 * Execute: node scripts/test-contabo-integration.js
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Carregar .env
config({ path: join(rootDir, '.env') })

const requiredVars = {
  CONTABO_ENDPOINT: process.env.CONTABO_ENDPOINT,
  CONTABO_BUCKET: process.env.CONTABO_BUCKET,
  CONTABO_ACCESS_KEY: process.env.CONTABO_ACCESS_KEY,
  CONTABO_SECRET_KEY: process.env.CONTABO_SECRET_KEY,
  CONTABO_REGION: process.env.CONTABO_REGION || 'default'
}

console.log('🔍 Testando integração com Contabo Storage...\n')
console.log('='.repeat(60))

// 1. Verificar variáveis de ambiente
console.log('\n1️⃣ Verificando variáveis de ambiente...\n')
let allVarsOk = true
for (const [key, value] of Object.entries(requiredVars)) {
  if (!value) {
    console.log(`❌ ${key}: NÃO DEFINIDA`)
    allVarsOk = false
  } else {
    const displayValue = key.includes('KEY') || key.includes('SECRET') 
      ? '***' + value.slice(-4) 
      : value
    console.log(`✅ ${key}: ${displayValue}`)
  }
}

if (!allVarsOk) {
  console.log('\n❌ Variáveis de ambiente incompletas!')
  process.exit(1)
}

// 2. Criar cliente S3
console.log('\n2️⃣ Criando cliente S3...\n')
const s3Client = new S3Client({
  endpoint: `https://${requiredVars.CONTABO_ENDPOINT}`,
  region: requiredVars.CONTABO_REGION,
  credentials: {
    accessKeyId: requiredVars.CONTABO_ACCESS_KEY,
    secretAccessKey: requiredVars.CONTABO_SECRET_KEY
  },
  forcePathStyle: true
})

console.log(`✅ Cliente S3 criado`)
console.log(`   Endpoint: https://${requiredVars.CONTABO_ENDPOINT}`)
console.log(`   Bucket: ${requiredVars.CONTABO_BUCKET}`)
console.log(`   Region: ${requiredVars.CONTABO_REGION}`)

// 3. Testar conexão com o bucket
console.log('\n3️⃣ Testando conexão com o bucket...\n')
try {
  const headCommand = new HeadBucketCommand({
    Bucket: requiredVars.CONTABO_BUCKET
  })
  await s3Client.send(headCommand)
  console.log('✅ Bucket existe e está acessível!')
} catch (error) {
  console.error('❌ Erro ao acessar bucket:', error.message)
  if (error.name === 'NotFound') {
    console.error('   → O bucket não existe ou o nome está incorreto')
  } else if (error.name === 'Forbidden' || error.name === 'AccessDenied') {
    console.error('   → Credenciais inválidas ou sem permissão no bucket')
  } else if (error.name === 'NetworkingError' || error.code === 'ENOTFOUND') {
    console.error('   → Endpoint inválido ou sem conexão com a Contabo')
  }
  process.exit(1)
}

// 4. Testar upload (presigned URL)
console.log('\n4️⃣ Testando geração de presigned URL (PUT)...\n')
try {
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
  const testKey = `test/integration-test-${Date.now()}.json`
  const testContent = JSON.stringify({ test: true, timestamp: new Date().toISOString() })
  
  const putCommand = new PutObjectCommand({
    Bucket: requiredVars.CONTABO_BUCKET,
    Key: testKey,
    ContentType: 'application/json'
  })
  
  const presignedUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 3600 })
  console.log('✅ Presigned URL gerada com sucesso!')
  console.log(`   URL: ${presignedUrl.substring(0, 80)}...`)
  
  // Testar upload real
  console.log('\n5️⃣ Testando upload real...\n')
  const uploadResponse = await fetch(presignedUrl, {
    method: 'PUT',
    body: testContent,
    headers: {
      'Content-Type': 'application/json'
    }
  })
  
  if (uploadResponse.ok) {
    console.log('✅ Upload realizado com sucesso!')
    console.log(`   Status: ${uploadResponse.status}`)
    
    // Testar download
    console.log('\n6️⃣ Testando download (presigned URL GET)...\n')
    const getCommand = new GetObjectCommand({
      Bucket: requiredVars.CONTABO_BUCKET,
      Key: testKey
    })
    
    const getPresignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 })
    const downloadResponse = await fetch(getPresignedUrl)
    
    if (downloadResponse.ok) {
      const downloadedContent = await downloadResponse.json()
      console.log('✅ Download realizado com sucesso!')
      console.log(`   Conteúdo: ${JSON.stringify(downloadedContent)}`)
      
      // Limpar arquivo de teste
      console.log('\n7️⃣ Limpando arquivo de teste...\n')
      // (Opcional: deletar o arquivo de teste)
      console.log('✅ Teste concluído!')
    } else {
      console.error('❌ Erro no download:', downloadResponse.status, downloadResponse.statusText)
      process.exit(1)
    }
  } else {
    console.error('❌ Erro no upload:', uploadResponse.status, uploadResponse.statusText)
    const errorText = await uploadResponse.text().catch(() => '')
    console.error('   Detalhes:', errorText)
    process.exit(1)
  }
  
} catch (error) {
  console.error('❌ Erro ao testar presigned URL:', error.message)
  console.error('   Stack:', error.stack)
  process.exit(1)
}

console.log('\n' + '='.repeat(60))
console.log('✅ INTEGRAÇÃO CONTABO FUNCIONANDO PERFEITAMENTE!')
console.log('='.repeat(60))
console.log('\n📝 Próximos passos:')
console.log('   1. Reinicie o servidor Nuxt (npm run dev)')
console.log('   2. Teste criando um Frame no editor')
console.log('   3. Verifique os logs no console do navegador')
console.log('\n')
