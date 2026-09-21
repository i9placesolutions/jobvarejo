import type {VideoDocument,VideoFormat} from './model'
export interface VideoElementTransform { x:number;y:number;scale:number;rotation:number;hidden?:boolean }
export type VideoLayoutEdits=Partial<Record<VideoFormat,Record<string,Record<string,VideoElementTransform>>>>
export const defaultTransform=():VideoElementTransform=>({x:0,y:0,scale:1,rotation:0})
export const elementTransform=(doc:VideoDocument,format:VideoFormat,scene:string,id:string):VideoElementTransform=>doc.layoutEdits?.[format]?.[scene]?.[id]||defaultTransform()
export function setElementTransform(doc:VideoDocument,format:VideoFormat,scene:string,id:string,value:VideoElementTransform){
 const layouts=doc.layoutEdits ||= {};const scenes=layouts[format] ||= {};const elements=scenes[scene] ||= {};elements[id]={...value}
}
export const elementNames:Record<string,string>={seal:'Selo da campanha',logo:'Logo da loja',name:'Nome do produto',price:'Etiqueta de preço',validity:'Validade',condition:'Condição da oferta','product-0':'Produto principal','product-1':'Cópia 1','product-2':'Cópia 2','outro-social':'Redes sociais','outro-phone':'WhatsApp','outro-address':'Endereço e informações'}
export interface VideoEditorState {enabled:boolean;sceneId:string;selected:string;select:(id:string)=>void;change:(id:string,value:VideoElementTransform)=>void}
