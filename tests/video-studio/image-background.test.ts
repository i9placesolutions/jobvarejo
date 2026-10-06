import {describe,it,expect,vi,beforeEach} from 'vitest'
import sharp from 'sharp'

// O segmentador real (BiRefNet) é pesado; aqui só importa como o vídeo decide usá-lo.
// Função simples em vez de vi.fn: o registro de resultados do spy acusa promessas rejeitadas mesmo tratadas.
const segmenter={calls:0,impl:async(_input:Buffer):Promise<Buffer>=>{throw new Error('não configurado')}}
vi.mock('../../server/utils/image-processor',async()=>{
 const actual=await vi.importActual<typeof import('../../server/utils/image-processor')>('../../server/utils/image-processor')
 return {...actual,processImageWithOptions:(input:Buffer)=>{segmenter.calls++;return segmenter.impl(input)}}
})
const {prepareVideoImage}=await import('../../server/utils/video-studio/images')

const whiteProduct=async()=>sharp({create:{width:300,height:300,channels:3,background:'#ffffff'}})
 .composite([{input:await sharp({create:{width:100,height:180,channels:3,background:'#c62020'}}).png().toBuffer(),left:100,top:60}]).png().toBuffer()

describe('Remoção de fundo das fotos de produto no vídeo',()=>{
 beforeEach(()=>{segmenter.calls=0})

 it('remove o fundo da foto de produto quando pedido',async()=>{
  const cutout=await sharp({create:{width:100,height:180,channels:4,background:'#c62020'}}).png().toBuffer()
  segmenter.impl=async()=>cutout
  const image=await prepareVideoImage(await whiteProduct(),{removeBackground:true})
  expect(segmenter.calls).toBe(1)
  expect(image.width).toBe(100);expect(image.height).toBe(180)
 })

 it('não segmenta de novo um recorte que já é transparente',async()=>{
  const subject=await sharp({create:{width:80,height:120,channels:4,background:'#2050c6'}}).png().toBuffer()
  const transparent=await sharp({create:{width:200,height:200,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:subject,left:60,top:40}]).png().toBuffer()
  const image=await prepareVideoImage(transparent,{removeBackground:true})
  expect(segmenter.calls).toBe(0)
  expect(image.width).toBe(80);expect(image.height).toBe(120)
 })

 it('mantém a foto original se a remoção falhar',async()=>{
  segmenter.impl=async()=>{throw new Error('modelo indisponível')}
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
  const image=await prepareVideoImage(await whiteProduct(),{removeBackground:true})
  expect(segmenter.calls).toBe(1)
  // Sem recorte, o trim remove só a borda branca uniforme; o quadro do produto continua.
  expect(image.width).toBe(100);expect(image.height).toBe(180)
  expect(warn).toHaveBeenCalled();warn.mockRestore()
 })

 it('não mexe na imagem quando a remoção não foi pedida (logo e demais imagens)',async()=>{
  const image=await prepareVideoImage(await whiteProduct())
  expect(segmenter.calls).toBe(0)
  expect(image.width).toBe(100)
 })
})
