import { readFileSync } from 'fs'

const env = readFileSync('.env', 'utf8')
const key = env.match(/NUXT_OPENAI_API_KEY=(.+)/)?.[1]?.trim()

if (!key) {
  console.log('NO KEY FOUND')
  process.exit(1)
}

console.log('Key length:', key.length, '| prefix:', key.substring(0, 8))

// Test 1: Check API key validity
try {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${key}` }
  })
  const data = await res.json()
  
  if (data.error) {
    console.log('API ERROR:', data.error.message)
    process.exit(1)
  }
  
  const imgModels = (data.data || []).filter(m => 
    m.id.includes('image') || m.id.includes('dall') || m.id.includes('gpt-image')
  )
  console.log('Image models available:', imgModels.map(m => m.id).join(', ') || 'NONE')
  console.log('API key status: OK')
} catch (e) {
  console.log('Connection error:', e.message)
}

// Test 2: Try a minimal image generation request
console.log('\nTesting gpt-image-1 generation...')
try {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: 'A simple red circle on white background',
      size: '1024x1024'
    })
  })
  const data = await res.json()
  
  if (!res.ok) {
    console.log('Generation ERROR:', res.status, data?.error?.message || JSON.stringify(data))
  } else {
    const hasB64 = !!data?.data?.[0]?.b64_json
    const hasUrl = !!data?.data?.[0]?.url
    console.log('Generation OK! Has b64_json:', hasB64, '| Has url:', hasUrl)
  }
} catch (e) {
  console.log('Generation fetch error:', e.message)
}
