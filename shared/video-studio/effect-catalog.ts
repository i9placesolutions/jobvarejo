import generatedFlyers from './generated-flyer-recipes.json'
// Biblioteca própria. Nomes do CapCut ficam apenas na documentação de referência.
export const PRODUCT_ENTRANCES = [
  {id:'slam',name:'Pancada frontal'}, {id:'whip-left',name:'Disparo pela esquerda'},
  {id:'whip-right',name:'Disparo pela direita'}, {id:'rise',name:'Subida explosiva'},
  {id:'drop',name:'Queda rápida'}, {id:'tilt',name:'Giro inclinado'},
  {id:'elastic',name:'Impulso elástico'}, {id:'zoom-out',name:'Recuo de câmera'},
] as const
export const TEXT_ENTRANCES = [
  {id:'slam',name:'Texto de impacto'}, {id:'word-pop',name:'Palavras em sequência'},
  {id:'whip',name:'Texto lançado'}, {id:'rise',name:'Subida rápida'},
  {id:'stretch',name:'Expansão'}, {id:'tilt',name:'Inclinação'},
  {id:'tracking',name:'Letras se aproximando'}, {id:'stomp',name:'Batida por palavra'},
] as const
export const CAMERA_MOVEMENTS = [
  {id:'impact',name:'Pancada e estabilização'}, {id:'earthquake',name:'Tremor forte'},
  {id:'handheld',name:'Câmera viva'}, {id:'swing',name:'Balanço lateral'},
  {id:'zoom-pulse',name:'Pulso de aproximação'}, {id:'none',name:'Câmera estável'},
] as const
export const SCENE_TRANSITIONS = [
  {id:'light',name:'Zoom com luz'}, {id:'slide',name:'Câmera rápida'},
  {id:'smoke',name:'Fumaça'}, {id:'fade',name:'Corte suave'},
  {id:'snap-zoom',name:'Zoom de impacto'}, {id:'whip-up',name:'Chicote vertical'},
  {id:'spin',name:'Giro de câmera'}, {id:'diagonal',name:'Corte diagonal'},
  {id:'shutter',name:'Persianas rápidas'}, {id:'iris',name:'Portal circular'},
  {id:'rgb',name:'Distorção de cor'}, {id:'blur',name:'Foco e desfoque'},
] as const
export const ATMOSPHERE_EFFECTS = [
  {id:'fire',name:'Fogo em camadas'}, {id:'fire-jets',name:'Labaredas de impacto'},
  {id:'embers',name:'Brasas ascendentes'}, {id:'smoke-plumes',name:'Fumaça volumétrica'},
  {id:'spark-burst',name:'Chuva de faíscas'}, {id:'laser-sweep',name:'Varredura de laser'},
  {id:'bokeh',name:'Luzes em profundidade'}, {id:'ribbons',name:'Fitas luminosas'},
  {id:'speed-lines',name:'Linhas de velocidade'}, {id:'shockwave',name:'Ondas de impacto'},
  {id:'spotlights',name:'Holofotes'}, {id:'lightning',name:'Descargas elétricas'},
  {id:'prism',name:'Reflexos de cor'}, {id:'dust',name:'Poeira em profundidade'},
  {id:'orbit',name:'Órbitas luminosas'}, {id:'grid',name:'Túnel geométrico'},
] as const
export const SOUND_EFFECTS = [
  {id:'air-swipe',name:'Passagem de ar',seconds:.42}, {id:'whip',name:'Chicote',seconds:.24},
  {id:'suction',name:'Sucção',seconds:.55}, {id:'riser',name:'Crescente',seconds:.8},
  {id:'bass-hit',name:'Impacto grave',seconds:.7}, {id:'metal-hit',name:'Impacto metálico',seconds:.7},
  {id:'pop',name:'Estalo',seconds:.18}, {id:'snap',name:'Batida seca',seconds:.16},
  {id:'coin',name:'Moeda',seconds:.6}, {id:'sparkle',name:'Brilho',seconds:.8},
  {id:'glitch',name:'Pulso digital',seconds:.3}, {id:'boom',name:'Explosão curta',seconds:.85},
] as const
export const BUILTIN_MUSIC = [
  ...generatedFlyers.map(r=>({id:r.music,name:`${r.name} · ${r.musicStyle} · ${r.bpm} BPM`})),
  {id:'upbeat',name:'Animada'}, {id:'energy',name:'Energia'}, {id:'calm',name:'Leve'},
  {id:'retail-drive',name:'Varejo eletrônico · 140 BPM'}, {id:'retail-bounce',name:'Varejo groove · 128 BPM'},
] as const
export const PRODUCT_FINISHES = [
  {id:'clean',name:'Imagem original'}, {id:'shine',name:'Reflexo de luz'},
  {id:'glow',name:'Halo luminoso'}, {id:'chromatic',name:'Impacto RGB'},
  {id:'zoom-blur',name:'Desfoque na chegada'}, {id:'outline',name:'Contorno luminoso'},
] as const
export type ProductEntrance = typeof PRODUCT_ENTRANCES[number]['id']
export type TextEntrance = typeof TEXT_ENTRANCES[number]['id']
export type CameraMovement = typeof CAMERA_MOVEMENTS[number]['id']
export type SceneTransition = typeof SCENE_TRANSITIONS[number]['id']
export type AtmosphereEffect = typeof ATMOSPHERE_EFFECTS[number]['id']
export type SoundEffect = typeof SOUND_EFFECTS[number]['id']
export interface VideoMotionSettings {
  product: ProductEntrance; text: TextEntrance; price: ProductEntrance; camera: CameraMovement
  atmosphere: AtmosphereEffect[]; speed: 'fast'|'balanced'; transitionSound: SoundEffect; accentSound: SoundEffect
  finish?: typeof PRODUCT_FINISHES[number]['id']
}
export const DEFAULT_MOTION: VideoMotionSettings = {product:'slam',text:'word-pop',price:'elastic',camera:'impact',atmosphere:['speed-lines','shockwave','dust'],speed:'fast',transitionSound:'air-swipe',accentSound:'bass-hit',finish:'shine'}
export const MOTION_PRESETS: {id:string;name:string;description:string;color:string;transition:SceneTransition;motion:VideoMotionSettings}[] = [
  {id:'pressure',name:'Pancada de ofertas',description:'Disparo, palavras marcadas e impacto grave.',color:'#b2e540',transition:'snap-zoom',motion:{...DEFAULT_MOTION}},
  {id:'flash',name:'Flash de preços',description:'Câmera lateral, reflexos e preço em destaque.',color:'#ffc55c',transition:'slide',motion:{...DEFAULT_MOTION,product:'whip-left',text:'whip',price:'slam',camera:'handheld',atmosphere:['speed-lines','spotlights','prism'],transitionSound:'whip',accentSound:'coin'}},
  {id:'storm',name:'Explosão de ofertas',description:'Tremor forte, descargas e subida explosiva.',color:'#8be0ff',transition:'diagonal',motion:{...DEFAULT_MOTION,finish:'glow',product:'rise',text:'stomp',price:'drop',camera:'earthquake',atmosphere:['lightning','shockwave','dust'],transitionSound:'suction',accentSound:'boom'}},
  {id:'party',name:'Festa de descontos',description:'Impulso, balanço e órbitas de luz.',color:'#ffb9df',transition:'iris',motion:{...DEFAULT_MOTION,product:'elastic',text:'tilt',price:'tilt',camera:'swing',atmosphere:['orbit','prism','shockwave'],transitionSound:'air-swipe',accentSound:'sparkle'}},
  {id:'neon',name:'Varejo digital',description:'Túnel geométrico, zoom e pulso digital.',color:'#aeb0ff',transition:'rgb',motion:{...DEFAULT_MOTION,finish:'chromatic',product:'zoom-out',text:'stretch',price:'whip-right',camera:'zoom-pulse',atmosphere:['grid','spotlights','speed-lines'],transitionSound:'glitch',accentSound:'metal-hit'}},
  {id:'focus',name:'Destaque direto',description:'Movimento preciso com leitura mais tranquila.',color:'#a7debd',transition:'blur',motion:{...DEFAULT_MOTION,finish:'clean',product:'tilt',text:'tracking',price:'rise',camera:'none',speed:'balanced',atmosphere:['dust','spotlights'],transitionSound:'air-swipe',accentSound:'pop'}},
]
export const motionSettings = (motion?: VideoMotionSettings): VideoMotionSettings => motion || DEFAULT_MOTION
export function identifyMotionPreset(motion:VideoMotionSettings|undefined,transition:SceneTransition) {
  if(!motion)return undefined
  return MOTION_PRESETS.find(p=>p.transition===transition&&Object.entries(p.motion).every(([key,value])=>{
    const current=motion[key as keyof VideoMotionSettings]
    return Array.isArray(value)&&Array.isArray(current)?[...value].sort().join('|')===[...current].sort().join('|'):value===current
  }))?.id
}
export const isBuiltinMusic = (id: string) => BUILTIN_MUSIC.some(item=>item.id===id)
export const soundAsset = (id: SoundEffect) => `sfx/${id}.wav`
