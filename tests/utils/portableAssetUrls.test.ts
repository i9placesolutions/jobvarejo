import { it, expect } from 'vitest'
import { normalizePortableAssetUrls, portableAssetUrl } from '../../utils/portableAssetUrls'
it('corrige src, original e metadados usados na reconstrução dos cards', () => {
 const url='http://localhost:4300/api/storage/p?key=imagens%2Fa.webp&v=123'
 const data:any={__assetUrlsNormalized:2,objects:[{src:url,__originalSrc:url,_productData:{imageUrl:url},clipPath:{src:url}}]}
 normalizePortableAssetUrls(data)
 expect(JSON.stringify(data)).not.toContain('localhost')
 expect(data.objects[0]._productData.imageUrl).toBe('/api/storage/p?key=imagens%2Fa.webp&v=123')
 expect(portableAssetUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg')
 expect(portableAssetUrl('http://localhost:8000/service')).toBe('http://localhost:8000/service')
})
