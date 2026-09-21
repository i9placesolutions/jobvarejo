import {describe,it,expect} from 'vitest'
import sharp from 'sharp'
import {prepareVideoImage} from '../../server/utils/video-studio/images'
describe('Auto-trim de imagens do vídeo',()=>{
 it('remove margem transparente sem cortar a embalagem e conserva proporção',async()=>{
  const subject=await sharp({create:{width:120,height:200,channels:4,background:'#c62020'}}).png().toBuffer()
  const source=await sharp({create:{width:500,height:500,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:subject,left:170,top:100}]).png().toBuffer()
  const image=await prepareVideoImage(source)
  expect(image.width).toBe(120);expect(image.height).toBe(200);expect(image.aspectRatio).toBe(.6)
 })
})
