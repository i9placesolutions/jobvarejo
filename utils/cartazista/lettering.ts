import type { ArtComposition, ArtLayer } from '~/types/art-studio'
import type { CartazistaModelKey, CartazistaProduct, CartazistaSettings } from '~/types/cartazista'

// Traço vetorial próprio: as bordas irregulares acompanham o pincel do cartaz.
const BRUSH = 'M 3 5 L 30 2 L 55 4 L 78 0 L 97 4 L 96 13 L 100 18 L 97 28 L 100 36 L 97 44 L 99 55 L 96 63 L 100 72 L 97 81 L 99 91 L 74 96 L 46 94 L 21 100 L 1 96 L 3 85 L 0 78 L 4 67 L 1 57 L 4 48 L 0 39 L 3 29 L 1 20 L 5 15 Z'
type Palette = { background: string; accent: string; ink: string; price: string; secondary: string }
const boxed = (id: string, kind: ArtLayer['kind'], x: number, y: number, width: number, height: number, fill: string, extra: Partial<ArtLayer> = {}): ArtLayer => ({ id, name: id, kind, x, y, width, height, fill, rotation: 0, visible: true, locked: false, opacity: 1, ...extra })

export function posterLettering(width: number, height: number, model: CartazistaModelKey, palette: Palette): ArtComposition {
  const layers: ArtLayer[] = []
  const wide = width > height
  const sx = width / 840, sy = height / 1190
  const text = (id: string, value: string, x: number, y: number, w: number, h: number, size: number, fill = palette.ink, family = 'Knewave') => {
    layers.push(boxed(id, 'text', x*sx, y*sy, w*sx, h*sy, fill, { text: value, fontFamily: family, fontWeight: family === 'Barlow Condensed' ? 800 : 400, fontSize: size*sy, fontScaleX: 1, lineHeight: .9, align: 'center' }))
  }
  const brush = (id: string, x: number, y: number, w: number, h: number) => layers.push(boxed(id, 'shape', x*sx,y*sy,w*sx,h*sy,palette.secondary,{shape:'path',pathData:BRUSH}))
  const line = (id: string, y: number) => layers.push(boxed(id,'shape',55*sx,y*sy,730*sx,1.5*sy,'#cccccc'))
  const price = (id: string, y: number, h: number, x = 70, w = 700) => {
    brush(`${id}-brush`,x-12,y+28,w+24,h-35)
    text(id,'99',x,y,w*.68,h,h*.92,palette.price)
    layers[layers.length-1]!.align='right'
    text(`${id}-cents`,',99',x+w*.64,y+h*.06,w*.36,h*.52,h*.42,palette.price)
    layers[layers.length-1]!.align='left'
    text(`${id}-unit`,'CADA',x+w*.70,y+h*.65,w*.27,h*.2,h*.13,palette.price,'Barlow Condensed')
  }
  const pocket = model === 'pocket'
  const dual = ['second-unit','wholesale-retail','pack','leve-3-2','leve-pague'].includes(model)
  const club = model === 'club' || model === 'club-discount'
  const dePor = ['de-por','de-por-discount','club-discount'].includes(model)
  const combo = ['leve-x-y','leve-por-legacy'].includes(model)
  if (!pocket) {
    brush('cartaz-header-brush',65,35,710,170)
    text('cartaz-offer-label','OFERTA',52,10,736,205,163,palette.price)
  }
  text('cartaz-product-name','PRODUTO\nMARCA',45,pocket?70:230,750,pocket?390:310,pocket?185:153)
  text('cartaz-unit','DESCRIÇÃO DO PRODUTO',55,pocket?470:550,730,62,48,palette.ink,'Barlow Condensed')
  line('cartaz-description-rule',620)
  if (dual) {
    text('cartaz-primary-label','UNIDADE',70,635,700,60,48,palette.ink,'Barlow Condensed')
    price('cartaz-price',690,145,225,390)
    text('cartaz-secondary-label','CONDIÇÃO ESPECIAL',60,852,720,60,48,palette.price,'Barlow Condensed')
    price('cartaz-secondary-price',912,190)
  } else {
    if(dePor) {
      text('cartaz-old-price','DE 129,99',65,631,345,65,52,'#888888','Barlow Condensed')
      layers.push(boxed('cartaz-old-strike','shape',90*sx,662*sy,290*sx,4*sy,'#777777'))
      text('cartaz-primary-label','POR APENAS',420,631,355,65,51,palette.price,'Barlow Condensed')
    } else text('cartaz-primary-label',club?'PREÇO EXCLUSIVO DO CLUBE':combo?'LEVE 3 POR':'POR APENAS',60,630,720,65,48,club?palette.price:palette.ink,'Barlow Condensed')
    price('cartaz-price',710,330)
    text('cartaz-badge','',70,1050,700,62,44,palette.price,'Barlow Condensed')
  }
  text('cartaz-near-expiry','PRODUTO PRÓXIMO DA VALIDADE',55,1110,730,28,22,palette.price,'Barlow Condensed')
  text('cartaz-validity','',55,1144,450,24,18,palette.ink,'Barlow Condensed')
  text('cartaz-limit','',55,1168,450,20,16,palette.ink,'Barlow Condensed')
  // Marca discreta no rodapé, sem reduzir a área do preço.
  layers.push(boxed('cartaz-logo','image',670*sx,1125*sy,115*sx,58*sy,palette.ink,{src:'',fit:'contain',binding:'logo',autoTrim:true,visible:false}))
  if(wide) {
    // Faixa de oferta no topo; produto à esquerda e bloco de preço à direita.
    for(const l of layers) {
      if(l.id === 'cartaz-header-brush'){l.x=width*.05;l.y=height*.025;l.width=width*.90;l.height=height*.19}
      else if(l.id==='cartaz-offer-label'){l.x=width*.08;l.y=height*.005;l.width=width*.84;l.height=height*.22;l.fontSize=height*.18;l.fontScaleX=1}
      else if(l.id==='cartaz-product-name'){l.x=width*.035;l.y=height*.29;l.width=width*.43;l.height=height*.42;l.fontSize=height*.17;l.fontScaleX=1}
      else if(l.id==='cartaz-unit'){l.x=width*.04;l.y=height*.76;l.width=width*.42;l.height=height*.08;l.fontSize=height*.045;l.fontScaleX=1}
      else if(l.id.startsWith('cartaz-price') || l.id.startsWith('cartaz-secondary') || ['cartaz-primary-label','cartaz-old-price','cartaz-old-strike','cartaz-badge'].includes(l.id)) {
        l.x=width*.49+l.x*.51;l.width*=.51;l.y=height*.26+(l.y/height-.53)*height*1.2;l.height*=1.2
        if(l.fontSize)l.fontSize*=1.2
        l.fontScaleX=1
      } else if(l.id==='cartaz-description-rule')l.visible=false
    }
  }
  if (model === 'banner-2m') {
    const set = (id: string, values: Partial<ArtLayer>) => Object.assign(layers.find(layer => layer.id === id)!, values)
    set('cartaz-header-brush', { x: width*.015, y: height*.07, width: width*.1, height: height*.86 })
    set('cartaz-offer-label', { x: width*.015, y: height*.04, width: width*.095, height: height*.9, fontSize: height*.17, text: 'O\nF\nE\nR\nT\nA', lineHeight: .7 })
    set('cartaz-product-name', { x: width*.14, y: height*.12, width: width*.35, height: height*.58, fontSize: height*.25 })
    set('cartaz-unit', { x: width*.14, y: height*.73, width: width*.35, height: height*.12, fontSize: height*.09 })
    set('cartaz-price-brush', { x: width*.51, y: height*.16, width: width*.46, height: height*.68 })
    set('cartaz-price', { x: width*.52, y: height*.12, width: width*.29, height: height*.70, fontSize: height*.59 })
    set('cartaz-price-cents', { x: width*.81, y: height*.16, width: width*.15, height: height*.42, fontSize: height*.35 })
    set('cartaz-price-unit', { x: width*.81, y: height*.65, width: width*.15, height: height*.12, fontSize: height*.08 })
    set('cartaz-primary-label', { visible: false })
  }
  for (const id of ['cartaz-price', ...(dual ? ['cartaz-secondary-price'] : [])]) {
    const amount=layers.find(layer=>layer.id===id)!
    layers.push(boxed(`${id}-currency`, 'text', amount.x, amount.y, width*.08, height*.045, palette.price, {text:'R$', fontFamily:'Barlow Condensed', fontSize:height*.035, visible:false}))
  }
  layers.push(boxed('cartaz-fold-guide','text',width*.03,height*.003,width*.94,height*.023,palette.ink,{text:'- - - - - - - - - - - - DOBRE AQUI - - - - - - - - - - - -',fontFamily:'Barlow Condensed',fontSize:height*.014,align:'center',visible:false}))
  return {version:1,width,height,background:palette.background,layers}
}

export function updatePosterLettering(source: ArtComposition, model: CartazistaModelKey, product: CartazistaProduct, settings: CartazistaSettings): ArtComposition {
  const next: ArtComposition = JSON.parse(JSON.stringify(source))
  const find = (id: string) => next.layers.find(l=>l.id===id)
  const text = (id:string,value:string,visible=true) => {const l=find(id);if(l){l.text=value;l.visible=visible}}
  const money = (value:number) => value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
  const price = (id:string,value:number) => {
    const [integer,cents] = money(value).split(',')
    text(id,integer!);text(`${id}-cents`,`,${cents}`)
    text(`${id}-unit`,/^(kg|g|l|ml)$/i.test(product.unit||'') ? product.unit!.toUpperCase() : 'CADA', settings.showEach !== false)
    text(`${id}-currency`,'R$',!!settings.showCurrency)
    const main=find(id),fraction=find(`${id}-cents`),brush=find(`${id}-brush`),unit=find(`${id}-unit`)
    if(main&&fraction&&brush){
      const ratio=integer!.length*.62+.55
      const total=Math.min(brush.width*.94,main.height*ratio)
      const decimals=total*.55/ratio
      main.x=brush.x+(brush.width-total)/2;main.width=total-decimals
      fraction.x=main.x+main.width+total*.025;fraction.width=decimals-total*.025
      if(unit){unit.x=fraction.x;unit.width=fraction.width}
    }
  }
  text('cartaz-product-name',product.name.toLocaleUpperCase('pt-BR'))
  if (settings.title !== undefined) text('cartaz-offer-label',model === 'banner-2m' ? settings.title.toUpperCase().split('').join('\n') : settings.title.toUpperCase())
  text('cartaz-fold-guide','- - - - - - - - - - - - DOBRE AQUI - - - - - - - - - - - -',!!settings.foldGuide)
  text('cartaz-unit',product.unit ? product.unit.toLocaleUpperCase('pt-BR') : 'DESCRIÇÃO DO PRODUTO')
  const old = product.oldPrice
  const discount = old && old>product.price ? Math.round((1-product.price/old)*100) : 0
  const club = model==='club'||model==='club-discount'
  text('cartaz-old-price',old!=null?`DE ${money(old)}`:'',old!=null)
  if(find('cartaz-old-strike'))find('cartaz-old-strike')!.visible=old!=null
  text('cartaz-badge',discount && ['de-por-discount','club-discount'].includes(model)?`${discount}% DE DESCONTO`:club?'EXCLUSIVO PARA CLIENTES DO CLUBE':'',!!discount&&['de-por-discount','club-discount'].includes(model)||club)
  price('cartaz-price',product.price)
  if(model==='second-unit'){text('cartaz-primary-label','PRIMEIRA UNIDADE');text('cartaz-secondary-label','A PARTIR DA SEGUNDA UNIDADE');price('cartaz-secondary-price',product.secondPrice??product.price)}
  if(model==='wholesale-retail'){text('cartaz-primary-label','VAREJO');text('cartaz-secondary-label','ATACADO');price('cartaz-secondary-price',product.wholesalePrice??product.price)}
  if(model==='pack'){text('cartaz-primary-label','UNIDADE');text('cartaz-secondary-label',`PACK COM ${product.packQuantity??3} UNIDADES`);price('cartaz-secondary-price',product.packPrice??product.price)}
  if(model==='leve-3-2'){text('cartaz-primary-label','LEVE 3 POR');price('cartaz-price',product.packPrice??product.price);text('cartaz-secondary-label','LEVE 2 POR');price('cartaz-secondary-price',product.secondPrice??product.price)}
  if(model==='leve-pague'){
    text('cartaz-primary-label','LEVE');text('cartaz-secondary-label','PAGUE')
    for(const [id,value] of [['cartaz-price',product.packQuantity??4],['cartaz-secondary-price',product.payQuantity??3]] as const){
      text(id,String(value));text(`${id}-cents`,'',false);text(`${id}-unit`,'',false);text(`${id}-currency`,'',false)
      const main=find(id),brush=find(`${id}-brush`)
      if(main&&brush){main.x=brush.x;main.width=brush.width;main.align='center'}
    }
  }
  if(model==='leve-x-y'||model==='leve-por-legacy'){text('cartaz-primary-label',`LEVE ${product.packQuantity??3} POR`);price('cartaz-price',product.packPrice??product.price);text('cartaz-badge',`OU R$ ${money(product.price)} CADA`)}
  if(model==='pack')text('cartaz-secondary-price-unit','PACK',settings.showEach!==false)
  if(['leve-3-2','leve-x-y','leve-por-legacy'].includes(model)){
    text('cartaz-price-unit','CONJUNTO',settings.showEach!==false)
    text('cartaz-secondary-price-unit','CONJUNTO',settings.showEach!==false)
  }
  text('cartaz-validity',settings.validity?`OFERTA VÁLIDA: ${settings.validity}`:'',!!settings.validity)
  text('cartaz-limit',settings.limitPerCustomer?`LIMITE: ${settings.limitPerCustomer}`:'',!!settings.limitPerCustomer)
  text('cartaz-near-expiry',settings.nearExpiryLabel,settings.highlightNearExpiry&&!!product.nearExpiry)
  if(settings.removeBackground){
    next.background='#ffffff'
    for(const layer of next.layers) if(layer.id.endsWith('-brush') || ['cartaz-campaign-background','cartaz-campaign-base'].includes(layer.id)) layer.visible=false
  }
  for(const layer of next.layers)if((layer as ArtLayer & {cartazistaHidden?:boolean}).cartazistaHidden)layer.visible=false
  return next
}
