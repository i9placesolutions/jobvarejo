import {CAMPAIGN_SOUNDS} from './campaign-direction'
import {REFERENCE_SOUNDS} from './reference-sounds'
import supplementalAudio from './supplemental-audio.json'
import musicLibrary from './music-library.json'
import sfxLibrary from './sfx-library.json'
// Biblioteca licenciada (uso comercial, sem atribuição): procedência em docs/video-studio/music-library-provenance.json.
const librarySounds = sfxLibrary as unknown as readonly {id:`lib-${string}`;name:string;seconds:number;category?:string}[]
const libraryMusic = (musicLibrary as unknown as {id:string;name:string;bpm:number;category?:string}[]).map(t=>({id:t.id,name:`${t.name} · ${t.bpm} BPM`}))
import generatedFlyers from './generated-flyer-recipes.json'
import type {DrawnFxSettings} from './drawn-fx-catalog'
// Origem dos áudios registrada em catalog-provenance.json.
// Supplemental IDs são validados em runtime pelo schema, sem alargar o tipo estático do catálogo.
const supplementalSounds = supplementalAudio.sounds as unknown as readonly {id:`cc0-${string}`;name:string;seconds:number}[]
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
export const SPECTACLE_EFFECTS = [
  {id:'fireworks-gold',name:'Fogos dourados'}, {id:'fireworks-multicolor',name:'Fogos coloridos'},
  {id:'fireworks-willow',name:'Fogos salgueiro'}, {id:'fireworks-ring',name:'Fogos em anel'},
  {id:'fireworks-heart',name:'Fogos em coração'}, {id:'fireworks-fountain',name:'Fonte de fogos'},
  {id:'explosion-fireball',name:'Bola de fogo'}, {id:'explosion-smoke',name:'Nuvem de explosão'},
  {id:'explosion-sparks',name:'Estilhaços de faíscas'}, {id:'explosion-shockrings',name:'Anéis de choque'},
  {id:'explosion-comic',name:'Explosão gráfica'},
  {id:'electric-fork',name:'Raio bifurcado'}, {id:'electric-chain',name:'Arco elétrico'},
  {id:'electric-orb',name:'Esfera elétrica'}, {id:'electric-storm',name:'Tempestade elétrica'},
  {id:'electric-border',name:'Contorno elétrico'},
  {id:'flame-columns',name:'Colunas de chamas'}, {id:'flame-wall',name:'Parede de fogo'},
  {id:'flame-blue',name:'Chamas azuis'}, {id:'flame-whirl',name:'Redemoinho de fogo'},
  {id:'energy-portal',name:'Portal de energia'}, {id:'energy-meteor',name:'Meteoro luminoso'},
  {id:'energy-aurora',name:'Aurora de energia'}, {id:'energy-starburst',name:'Estrela de energia'},
] as const
export const SCENE_TRANSITIONS = [
  {id:'light',name:'Zoom com luz'}, {id:'slide',name:'Câmera rápida'},
  {id:'smoke',name:'Fumaça'}, {id:'fade',name:'Corte suave'},
  {id:'snap-zoom',name:'Zoom de impacto'}, {id:'whip-up',name:'Chicote vertical'},
  {id:'spin',name:'Giro de câmera'}, {id:'diagonal',name:'Corte diagonal'},
  {id:'shutter',name:'Persianas rápidas'}, {id:'iris',name:'Portal circular'},
  {id:'rgb',name:'Distorção de cor'}, {id:'blur',name:'Foco e desfoque'},
  {id:'flash-wipe',name:'Corte com clarão'}, {id:'split-screen',name:'Corte dividido'},
  {id:'diamond-wipe',name:'Diamante luminoso'}, {id:'radial-burst',name:'Explosão radial'},
  {id:'bar-wipe',name:'Faixas laterais'}, {id:'pixel-dissolve',name:'Dissolução em pixels'},
  {id:'chevron-wipe',name:'Corte em V'}, {id:'ring-wipe',name:'Anel luminoso'},
  {id:'glitch-slice',name:'Fatias digitais'}, {id:'zoom-through',name:'Mergulho de câmera'},
  {id:'curtain',name:'Cortina de faixas'}, {id:'star-burst',name:'Estrela de impacto'},
  {id:'stripe-wipe',name:'Listras de oferta'}, {id:'confetti-pop',name:'Explosão de confete'},
] as const
/** Destaque animado sobre a etiqueta de preço de cada oferta. */
export const PRICE_ACCENTS = [
  {id:'none',name:'Sem destaque'}, {id:'shine',name:'Brilho passando'},
  {id:'stamp',name:'Carimbo de impacto'}, {id:'glow-pulse',name:'Pulso luminoso'},
  {id:'sparkle',name:'Estrelas piscando'}, {id:'confetti',name:'Confete no preço'},
] as const
/** Variada: cada oferta recebe transição, entradas, acabamento e destaque próprios (determinístico pela semente). */
export const MOTION_VARIATIONS = [
  {id:'varied',name:'Variada · cada oferta diferente'}, {id:'fixed',name:'Igual em todas as ofertas'},
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
  {id:'sprite-sparks',name:'Faíscas em profundidade'}, {id:'sprite-smoke',name:'Fumaça em camadas'},
  {id:'sprite-flare',name:'Reflexos de lente'}, {id:'sprite-stars',name:'Estrelas em profundidade'},
  {id:'sprite-rings',name:'Anéis luminosos'}, {id:'sprite-lightning',name:'Descargas em camada'},
  {id:'sprite-fire',name:'Chamas em profundidade'}, {id:'sprite-dust',name:'Poeira suspensa'},
  {id:'sprite-vortex',name:'Vórtice de luz'}, ...SPECTACLE_EFFECTS,
] as const
export const SOUND_EFFECTS = [
  ...supplementalSounds,
  ...librarySounds,
  ...REFERENCE_SOUNDS,
  ...CAMPAIGN_SOUNDS,
  {id:'retail-whoosh-v1',name:'Passagem curta · suave',seconds:.54},
  {id:'retail-pop-v1',name:'Entrada de preço · suave',seconds:.25},
  {id:'explosion-retail',name:'Explosão de varejo',seconds:1.45},
  {id:'air-swipe',name:'Passagem de ar',seconds:.42}, {id:'whip',name:'Chicote',seconds:.24},
  {id:'suction',name:'Sucção',seconds:.55}, {id:'riser',name:'Crescente',seconds:.8},
  {id:'bass-hit',name:'Impacto grave',seconds:.7}, {id:'metal-hit',name:'Impacto metálico',seconds:.7},
  {id:'pop',name:'Estalo',seconds:.18}, {id:'snap',name:'Batida seca',seconds:.16},
  {id:'coin',name:'Moeda',seconds:.6}, {id:'sparkle',name:'Brilho',seconds:.8},
  {id:'glitch',name:'Pulso digital',seconds:.3}, {id:'boom',name:'Explosão curta',seconds:.85},
] as const
export const BUILTIN_MUSIC = [
  ...libraryMusic,
  ...supplementalAudio.music,
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
export type PriceAccent = typeof PRICE_ACCENTS[number]['id']
export type MotionVariation = typeof MOTION_VARIATIONS[number]['id']
export interface VideoMotionSettings {
  product: ProductEntrance; text: TextEntrance; price: ProductEntrance; camera: CameraMovement
  atmosphere: AtmosphereEffect[]; speed: 'fast'|'balanced'; transitionSound: SoundEffect; accentSound: SoundEffect
  finish?: typeof PRODUCT_FINISHES[number]['id']
  /** Efeitos desenhados à mão por momento (preço, produto, troca de cena, ambiente) — drawn-fx.ts. */
  drawnFx?: DrawnFxSettings
}
export const DEFAULT_MOTION: VideoMotionSettings = {product:'slam',text:'word-pop',price:'elastic',camera:'impact',atmosphere:['speed-lines','shockwave','dust'],speed:'fast',transitionSound:'air-swipe',accentSound:'bass-hit',finish:'shine'}
export const MOTION_PRESETS: {id:string;name:string;description:string;color:string;transition:SceneTransition;motion:VideoMotionSettings}[] = [
  {id:'pressure',name:'Pancada de ofertas',description:'Disparo, palavras marcadas e impacto grave.',color:'#b2e540',transition:'snap-zoom',motion:{...DEFAULT_MOTION}},
  {id:'flash',name:'Flash de preços',description:'Câmera lateral, reflexos e preço em destaque.',color:'#ffc55c',transition:'slide',motion:{...DEFAULT_MOTION,product:'whip-left',text:'whip',price:'slam',camera:'handheld',atmosphere:['speed-lines','spotlights','prism'],transitionSound:'whip',accentSound:'coin'}},
  {id:'storm',name:'Explosão de ofertas',description:'Tremor forte, descargas e subida explosiva.',color:'#8be0ff',transition:'diagonal',motion:{...DEFAULT_MOTION,finish:'glow',product:'rise',text:'stomp',price:'drop',camera:'earthquake',atmosphere:['lightning','shockwave','dust'],transitionSound:'suction',accentSound:'boom'}},
  {id:'party',name:'Festa de descontos',description:'Impulso, balanço e órbitas de luz.',color:'#ffb9df',transition:'iris',motion:{...DEFAULT_MOTION,product:'elastic',text:'tilt',price:'tilt',camera:'swing',atmosphere:['orbit','prism','shockwave'],transitionSound:'air-swipe',accentSound:'sparkle'}},
  {id:'neon',name:'Varejo digital',description:'Túnel geométrico, zoom e pulso digital.',color:'#aeb0ff',transition:'rgb',motion:{...DEFAULT_MOTION,finish:'chromatic',product:'zoom-out',text:'stretch',price:'whip-right',camera:'zoom-pulse',atmosphere:['grid','spotlights','speed-lines'],transitionSound:'glitch',accentSound:'metal-hit'}},
  {id:'focus',name:'Destaque direto',description:'Movimento preciso com leitura mais tranquila.',color:'#a7debd',transition:'blur',motion:{...DEFAULT_MOTION,finish:'clean',product:'tilt',text:'tracking',price:'rise',camera:'none',speed:'balanced',atmosphere:['dust','spotlights'],transitionSound:'air-swipe',accentSound:'pop'}},
  {id:'fireworks',name:'Fogos dourados e coloridos',description:'Foguetes luminosos, reflexos festivos e corte radial.',color:'#ffcf70',transition:'radial-burst',motion:{...DEFAULT_MOTION,atmosphere:['fireworks-multicolor','fireworks-gold'],accentSound:'sparkle'}},
  {id:'inferno',name:'Inferno de ofertas',description:'Bola de fogo e colunas de chamas em uma entrada forte.',color:'#ff683c',transition:'snap-zoom',motion:{...DEFAULT_MOTION,atmosphere:['explosion-fireball','flame-columns'],accentSound:'boom'}},
  {id:'electric',name:'Pulso elétrico',description:'Arcos ramificados e esfera de energia com pulso digital.',color:'#63dfff',transition:'rgb',motion:{...DEFAULT_MOTION,atmosphere:['electric-fork','electric-orb'],accentSound:'glitch'}},
  {id:'festival',name:'Festival no céu',description:'Rastros salgueiro e uma fonte de luz em cascata.',color:'#f3b5ff',transition:'spin',motion:{...DEFAULT_MOTION,atmosphere:['fireworks-willow','fireworks-fountain'],accentSound:'sparkle'}},
  {id:'cosmic',name:'Portal cósmico',description:'Anéis de energia e meteoros cruzando o cenário.',color:'#9caaff',transition:'iris',motion:{...DEFAULT_MOTION,atmosphere:['energy-portal','energy-meteor'],transitionSound:'suction'}},
  {id:'impact-burst',name:'Impacto explosivo',description:'Ondas de choque e explosão gráfica no início da oferta.',color:'#ffc45c',transition:'diamond-wipe',motion:{...DEFAULT_MOTION,atmosphere:['explosion-shockrings','explosion-comic'],accentSound:'bass-hit'}},
  // Efeitos desenhados à mão (estilo RTFX), acervo Magnific — drawn-fx.ts.
  {id:'cartoon-boom',name:'Explosão cartoon',description:'Explosão desenhada em cada preço e transição desenhada entre ofertas.',color:'#ff8a3d',transition:'fade',motion:{...DEFAULT_MOTION,atmosphere:['shockwave'],accentSound:'boom',transitionSound:'air-swipe',drawnFx:{price:'explosao',product:'fumaca',transition:'transicao',ambient:'linhas'}}},
  {id:'cartoon-fire',name:'Fogo nas ofertas',description:'Chamas desenhadas nas bordas, explosão no preço e corte com fogo.',color:'#ff5a1f',transition:'fade',motion:{...DEFAULT_MOTION,camera:'earthquake',atmosphere:['embers'],accentSound:'boom',drawnFx:{price:'explosao',transition:'fogo',ambient:'fogo'}}},
  {id:'manga',name:'Mangá de ofertas',description:'Linhas de velocidade, estouros de quadrinhos e fumaça na chegada.',color:'#f2f2f2',transition:'fade',motion:{...DEFAULT_MOTION,text:'stomp',accentSound:'snap',drawnFx:{price:'comic',product:'fumaca',transition:'explosao',ambient:'linhas'}}},
  {id:'cartoon-electric',name:'Choque de preços',description:'Raios desenhados no preço e no cenário, transição de energia.',color:'#5ee7ff',transition:'fade',motion:{...DEFAULT_MOTION,accentSound:'glitch',drawnFx:{price:'eletricidade',product:'energia',transition:'transicao',ambient:'eletricidade'}}},
  {id:'cartoon-splash',name:'Respingo de ofertas',description:'Respingos e brilhos desenhados com corte em fumaça.',color:'#4fc3ff',transition:'fade',motion:{...DEFAULT_MOTION,product:'elastic',accentSound:'pop',drawnFx:{price:'liquido',product:'faiscas',transition:'fumaca'}}},
]
export const motionSettings = (motion?: VideoMotionSettings): VideoMotionSettings => motion || DEFAULT_MOTION
export function identifyMotionPreset(motion:VideoMotionSettings|undefined,transition:SceneTransition) {
  if(!motion)return undefined
  const fx=(v:unknown)=>JSON.stringify(Object.entries((v||{}) as Record<string,string>).filter(([,c])=>c&&c!=='none').sort())
  return MOTION_PRESETS.find(p=>p.transition===transition&&fx(p.motion.drawnFx)===fx(motion.drawnFx)&&Object.entries(p.motion).every(([key,value])=>{
    if(key==='drawnFx')return true
    const current=motion[key as keyof VideoMotionSettings]
    return Array.isArray(value)&&Array.isArray(current)?[...value].sort().join('|')===[...current].sort().join('|'):value===current
  }))?.id
}
export const isBuiltinMusic = (id: string) => BUILTIN_MUSIC.some(item=>item.id===id)
export const soundAsset = (id: SoundEffect) => `sfx/${id}.wav`
