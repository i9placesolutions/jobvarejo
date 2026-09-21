import {afterEach, describe, expect, it, vi} from 'vitest'
import {createPreviewImageCache} from '../../shared/video-studio/preview-media'
afterEach(()=>vi.restoreAllMocks())
describe('imagens completas antes do play',()=>{
 it('espera o download e a decodificação, e reutiliza a imagem nos loops',async()=>{
  const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(new Blob(['png'],{type:'image/png'})))
  vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:complete-image')
  vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
  let release!:()=>void
  const decode=vi.fn(()=>new Promise<void>(r=>{release=r})),cache=createPreviewImageCache(decode)
  let ready=false
  const first=cache.get('/api/videos/assets/image').then(url=>{ready=true;return url})
  await vi.waitFor(()=>expect(decode).toHaveBeenCalledOnce())
  expect(ready).toBe(false)
  const second=cache.get('/api/videos/assets/image')
  release()
  expect(await first).toBe('blob:complete-image');expect(await second).toBe('blob:complete-image')
  expect(fetcher).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[0]![0]).toBe('/api/videos/assets/image?preview=1')
  cache.dispose();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:complete-image')
 })
 it('bloqueia imagem inválida e permite nova tentativa',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response('erro',{status:503})).mockResolvedValueOnce(new Response(new Blob(['png'],{type:'image/png'})))
  vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:retry')
  vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
  const cache=createPreviewImageCache(async()=>{})
  await expect(cache.get('/image')).rejects.toThrow('carregar')
  await expect(cache.get('/image')).resolves.toBe('blob:retry')
  cache.dispose()
 })
})
