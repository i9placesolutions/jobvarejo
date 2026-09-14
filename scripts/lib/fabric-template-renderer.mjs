import http from 'node:http'
import { readFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

// Renderiza o canvas real; nunca pinta uma miniatura antiga com dados fictícios.
export async function createTemplateRenderer(readAsset) {
  const root = process.cwd()
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname === '/fabric.mjs') { res.setHeader('content-type', 'text/javascript'); res.end(await readFile(join(root, 'node_modules/fabric/dist/index.min.mjs'))); return }
      if (url.pathname === '/font.ttf') { res.end(await readFile(join(root, 'public/art-studio/fonts/Barlow-ExtraBold.ttf'))); return }
      if (url.pathname === '/api/storage/p') { res.end(await readAsset(url.searchParams.get('key'))); return }
      res.setHeader('content-type', 'text/html')
      res.end(`<style>@font-face{font-family:Barlow;src:url('/font.ttf');font-weight:100 900}</style><canvas id="c"></canvas><script type="module">
import {StaticCanvas} from '/fabric.mjs';
await document.fonts.load('900 24px Barlow');
window.renderTemplate=async(data,width,height)=>{
 const c=new StaticCanvas(document.createElement('canvas'),{width,height,renderOnAddRemove:false});
 try{await c.loadFromJSON(data);c.renderAll();return c.toDataURL({format:'png',multiplier:Math.min(1,600/width)});}finally{await c.dispose();}
};</script>`)
    } catch (error) { res.statusCode = 500; res.end(String(error)) }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const profile = await mkdtemp(join(tmpdir(), 'flyer-render-'))
  const chrome = spawn(process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const endpoint = await new Promise((resolve, reject) => {
    let output = ''; const timeout = setTimeout(() => reject(new Error('Chrome não iniciou')), 20000)
    chrome.on('error', reject)
    chrome.stderr.on('data', chunk => { output += chunk; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]) } })
  })
  const port = new URL(endpoint).port
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }))
  let id = 0; const pending = new Map()
  ws.addEventListener('message', event => { const data = JSON.parse(event.data); const item = pending.get(data.id); if (item) { pending.delete(data.id); data.error ? item.reject(new Error(data.error.message)) : item.resolve(data.result) } })
  const call = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
  await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
  for (let i = 0; i < 100; i++) {
    const r = await call('Runtime.evaluate', { expression: 'typeof window.renderTemplate', returnByValue: true })
    if (r.result?.value === 'function') break
    await new Promise(resolve => setTimeout(resolve, 100))
    if (i === 99) throw new Error('Fabric não iniciou')
  }
  return {
    async render(canvas, width, height) {
      const result = await call('Runtime.evaluate', { expression: `window.renderTemplate(${JSON.stringify(canvas)},${width},${height})`, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails || !result.result?.value?.startsWith('data:image/png;base64,')) throw new Error('Falha ao renderizar miniatura Fabric: ' + JSON.stringify(result.exceptionDetails))
      return Buffer.from(result.result.value.split(',')[1], 'base64')
    },
    async close() { ws.close(); chrome.kill(); await new Promise(resolve => server.close(resolve)) }
  }
}
