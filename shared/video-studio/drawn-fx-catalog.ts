/** Catálogo leve dos efeitos desenhados (sem React): usado pelo schema do servidor, pela interface e pela composição. */
export const DRAWN_FX_CATEGORIES = [
  {id:'none',name:'Sem efeito'},
  {id:'explosao',name:'Explosões desenhadas'}, {id:'fogo',name:'Fogo desenhado'}, {id:'fumaca',name:'Fumaça e poeira'},
  {id:'energia',name:'Energia'}, {id:'eletricidade',name:'Eletricidade'}, {id:'faiscas',name:'Faíscas e brilhos'},
  {id:'liquido',name:'Respingos'}, {id:'linhas',name:'Linhas de velocidade'}, {id:'comic',name:'Quadrinhos'},
  {id:'transicao',name:'Transição desenhada'},
] as const
export type DrawnFxCategory = typeof DRAWN_FX_CATEGORIES[number]['id']
export const DRAWN_FX_MOMENTS = [
  {id:'price',name:'Entrada do preço'}, {id:'product',name:'Entrada do produto'},
  {id:'transition',name:'Troca de cena'}, {id:'ambient',name:'Ambiente contínuo'},
] as const
export type DrawnFxMoment = typeof DRAWN_FX_MOMENTS[number]['id']
export type DrawnFxSettings = Partial<Record<DrawnFxMoment,DrawnFxCategory>>

/** Categorias que fazem sentido em cada momento (transição cobre a tela; ambiente fica em laço). */
export const DRAWN_FX_FOR_MOMENT: Record<DrawnFxMoment,DrawnFxCategory[]> = {
  price:['none','explosao','comic','faiscas','energia','eletricidade','fumaca','fogo','liquido'],
  product:['none','fumaca','explosao','faiscas','energia','eletricidade','liquido','comic'],
  transition:['none','transicao','explosao','fumaca','fogo','liquido'],
  ambient:['none','linhas','fogo','faiscas','eletricidade','energia'],
}

/** Efeitos desenhados dos modelos prontos, pelo tema da receita (vídeos já criados não mudam). */
export function drawnFxForTheme(text:string,seed=0):DrawnFxSettings{
  const t=text.toLowerCase()
  if(/carne|churras|açougue|acougue|suín|suin|black|queima|fogo|inferno|brasa|picanha|frango/.test(t))return {price:'explosao',transition:'fogo',ambient:'fogo'}
  if(/relâmpago|relampago|elétric|eletric|energia|turbo|turbinad|neon/.test(t))return {price:'eletricidade',transition:'transicao',ambient:'eletricidade'}
  if(/festa|criança|crianca|aniversário|aniversario|carnaval|kids|divers/.test(t))return {price:'comic',product:'faiscas',transition:'transicao',ambient:'faiscas'}
  if(/hortifruti|feira|verde|bebida|cerveja|gelad|água|agua/.test(t))return {price:'liquido',product:'fumaca',transition:'transicao'}
  const rotation:DrawnFxSettings[]=[
    {price:'explosao',product:'fumaca',transition:'transicao',ambient:'linhas'},
    {price:'comic',transition:'explosao',ambient:'linhas'},
    {price:'faiscas',product:'fumaca',transition:'transicao'},
    {price:'energia',transition:'fumaca',ambient:'faiscas'},
  ]
  return rotation[Math.abs(Math.round(seed))%rotation.length]!
}
