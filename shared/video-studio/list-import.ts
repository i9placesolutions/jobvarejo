import {inferUnitLabelFromProduct} from '../../utils/priceTagText'
import {parseOfferPrice,type VideoOffer} from './model'
const condition=(p:Record<string,any>)=>[...new Set([p.limit,p.limitText,p.condition,p.specialCondition].filter(Boolean).map(String))].join(' · ')
export function videoListIssue(p:Record<string,any>):string {
 if(p.offerFormat||(p.pricePack&&p.pricePack!==(p.price||p.priceUnit))||Number(p.packQuantity)>1||p.priceSpecial||p.priceSpecialUnit||p.priceWholesale||p.wholesaleTrigger)return 'Oferta com preços ou condições múltiplas. Configure uma oferta específica antes de levar ao vídeo.'
 if(String(p.name||'').length>120)return 'Encurte o nome do produto antes de importar.'
 if(!p.name?.trim()||parseOfferPrice(String(p.price||p.priceUnit||''))===null)return 'Confira o nome e o preço.'
 if(condition(p).length>140)return 'A condição excede o espaço do vídeo. Revise o texto sem perder a restrição.'
 return ''
}
export function videoOfferFromList(p:Record<string,any>,id:string):VideoOffer {
 const issue=videoListIssue(p);if(issue)throw Error(issue)
 return {id,name:String(p.name).slice(0,120),price:String(p.price||p.priceUnit),unit:inferUnitLabelFromProduct(p)||'UN',condition:condition(p),image:''}
}
