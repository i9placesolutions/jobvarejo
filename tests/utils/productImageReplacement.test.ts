import { describe, expect, it } from 'vitest'
import { replaceProductImageCopies, findOverflowingProductImageAtPoint } from '~/utils/productImageComposition'

const image = (id: string, src = '/api/storage/proxy?key=products%2Frice.png') => ({
  type: 'image', name: 'smart_image', _customId: id, src,
  width: 100, height: 200, scaleX: 0.8, scaleY: 0.5,
  left: 20, top: -15, angle: 12, flipX: true,
  setElement(element: any) { this.element = element; this.width = 999; this.height = 999 },
  element: null as any,
  set(props: any) { Object.assign(this, props) }
})
const replacement = { width: 200, height: 400, cropX: 8, cropY: 12, getElement: () => 'new texture' }

describe('replaceProductImageCopies', () => {
  it('troca todas as cópias preservando IDs e rotação, com proporção e novo encaixe', () => {
    const first = image('one'), copy = image('two')
    copy.left = 70
    const card = { width: 300, height: 300, getObjects: () => [first, copy] }
    expect(replaceProductImageCopies(card, copy, replacement, '/new.png')).toEqual([first, copy])
    for (const img of [first, copy]) {
      expect(img.width * img.scaleX).toBe(96)
      expect(img.height * img.scaleY).toBe(192)
      expect(img).toMatchObject({ src: '/new.png', __originalSrc: '/new.png', angle: 12, top: 0, flipX: true, cropX: 8, cropY: 12, __manualTransform: true })
    }
    expect([first._customId, copy._customId, first.left, copy.left]).toEqual(['one', 'two', -64.5, 64.5])
  })
  it('não troca imagens diferentes, fundos da etiqueta nem outro card', () => {
    const first = image('one'), other = image('other', '/beans.png'), label = image('label')
    label.name = 'label_bg_image'
    const unrelated = image('unrelated')
    const card = { width: 300, height: 300, getObjects: () => [first, other, label] }
    expect(replaceProductImageCopies(card, first, replacement, '/new.png')).toEqual([first])
    expect(other.src).toBe('/beans.png')
    expect(label.src).toContain('rice')
    expect(unrelated.src).toContain('rice')
  })
})

it('reencaixa uma imagem antiga maior que o card sem ampliar o card', () => {
  const target = image('oversized'); target.width = 410; target.height = 721;
  target.scaleX = 1.0156; target.scaleY = 1.1635; target.left = -360; target.top = -421;
  const card = { width: 115, height: 77, getObjects: () => [target] };
  replaceProductImageCopies(card, target, replacement, '/new.png');
  expect(target.width * target.scaleX).toBeLessThanOrEqual(115);
  expect(target.height * target.scaleY).toBeLessThanOrEqual(77 * 0.64);
  expect([target.left, target.top, card.width, card.height]).toEqual([0, 0, 115, 77]);
});

it('mantém o encaixe e o vínculo em um Group real do Fabric após serializar', async () => {
  const { FabricImage, Group, Rect, LayoutManager, FixedLayout, getEnv } = await import('fabric/node')
  const texture = getEnv().document.createElement('canvas')
  texture.width = 410; texture.height = 721
  const target = new FabricImage(texture, { name: 'smart_image', originX: 'center', originY: 'center' } as any)
  const card = new Group([new Rect({ width: 115, height: 77, originX: 'center', originY: 'center' }), target], {
    width: 115, height: 77, layoutManager: new LayoutManager(new FixedLayout())
  })
  target.set({ width: 410, height: 721, scaleX: 1.0156, scaleY: 1.1635, left: -360, top: -421 })
  const newTexture = getEnv().document.createElement('canvas')
  newTexture.width = 800; newTexture.height = 1200
  const replacement = new FabricImage(newTexture)
  replaceProductImageCopies(card, target, replacement, '/new.png')
  expect(target.group).toBe(card)
  expect(target.getScaledWidth()).toBeLessThanOrEqual(115)
  expect(target.getScaledHeight()).toBeLessThanOrEqual(77)
  const saved = card.toObject(['name', '__originalSrc', '__manualTransform'] as any)
  const savedImage = saved.objects.find((object: any) => object.name === 'smart_image') as any
  expect(savedImage.width * savedImage.scaleX).toBeLessThanOrEqual(115)
  expect(savedImage.__originalSrc).toBe('/new.png')
  expect(savedImage.__manualTransform).toBe(true)
})

it('seleciona pixels da imagem fora do card, sem tomar cliques dentro do card', () => {
  const product = image('overflow') as any
  product.containsPoint = () => true
  const card = { getObjects: () => [product], containsPoint: (point: any) => point.x < 100 }
  expect(findOverflowingProductImageAtPoint([card], { x: 200, y: 0 })).toBe(product)
  expect(findOverflowingProductImageAtPoint([card], { x: 50, y: 0 })).toBeNull()
  product.visible = false
  expect(findOverflowingProductImageAtPoint([card], { x: 200, y: 0 })).toBeNull()
})

it('amplia uma foto nova sem herdar a caixa pequena e evita título/preço', () => {
 const target = image('tiny'); target.width=20;target.height=20;target.scaleX=.1;target.scaleY=.1;
 const title={name:'smart_title',top:-145,height:35,scaleY:1,originY:'top'};
 const price={name:'priceGroup',top:100,height:70,scaleY:1,originY:'center'};
 const card={width:300,height:300,getObjects:()=>[title,target,price]};
 replaceProductImageCopies(card,target,{width:600,height:300,getElement:()=> 'new'},'/wide.png');
 expect(target.scaleX).toBe(target.scaleY);
 expect(target.width*target.scaleX).toBe(258);
 expect(target.top-target.height*target.scaleY/2).toBeGreaterThan(-110);
 expect(target.top+target.height*target.scaleY/2).toBeLessThan(65);
});

it('troca somente a imagem escolhida mesmo que existam cópias iguais',()=>{
 const first=image('one'),second=image('two');const card={width:300,height:300,getObjects:()=>[first,second]}
 expect(replaceProductImageCopies(card,first,replacement,'/uva.png','single')).toEqual([first])
 expect(second.src).not.toBe('/uva.png')
})
it('troca todas as imagens diferentes somente dentro do card escolhido',()=>{
 const first=image('one'),second=image('two','/morango.png'),other=image('other','/uva.png');const card={width:300,height:300,getObjects:()=>[first,second]}
 expect(replaceProductImageCopies(card,first,replacement,'/new.png','all')).toEqual([first,second])
 expect(second.src).toBe('/new.png');expect(other.src).toBe('/uva.png')
})

it('a troca explícita preserva a posição manual e não desloca o outro sabor',()=>{
 const first=image('one'),second=image('two','/morango.png');first.left=-77;first.top=43;second.left=81;
 const before=JSON.stringify(second),card={width:300,height:300,getObjects:()=>[first,second]}
 replaceProductImageCopies(card,first,replacement,'/uva.png','single')
 expect(first.left).toBe(-77);expect(first.top).toBe(43);expect(JSON.stringify(second)).toBe(before)
 expect(first.width*first.scaleX).toBeLessThanOrEqual(80)
 expect(first.height*first.scaleY).toBeLessThanOrEqual(100)
})
