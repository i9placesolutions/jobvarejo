import recipes from './generated-flyer-recipes.json'
export const CAMPAIGN_FAMILIES = ['boom','bakery','alarm','lightning','grill','clearance','harvest','children','celebration','rose','spooky','clock','neon','industrial','show','savings','impact'] as const
export type CampaignFamily = typeof CAMPAIGN_FAMILIES[number]
export function classifyCampaign(name:string,sourceId?:string):CampaignFamily {
 if(sourceId==='c69acb2e-1446-40a5-913e-82cfd822cffc'||/padaria/i.test(name))return 'bakery'
 const n=name.toLocaleLowerCase('pt-BR')
 if(/boom/.test(n))return 'boom'
 if(/alerta/.test(n))return 'alarm'
 if(/relâmpago/.test(n))return 'lightning'
 if(/carne|suína|churras|açougue|acougue/.test(n))return 'grill'
 if(/queima|liquida|saldão/.test(n))return 'clearance'
 if(/horti|feira/.test(n)||(/verde/.test(n)&&!/dia d\b/.test(n)))return 'harvest'
 if(/criança/.test(n))return 'children'
 if(/halloween/.test(n))return 'spooky'
 if(/rosa|coração/.test(n))return 'rose'
 if(/hora|calendário|fecha mês|fecha mes|oferta de hoje|oferta do dia/.test(n))return 'clock'
 if(/neon/.test(n))return 'neon'
 if(/industrial/.test(n))return 'industrial'
 if(/show|cliente|consumidor/.test(n))return 'show'
 if(/fim de ano|família|sextooou|independ/.test(n))return 'celebration'
 if(/dia d|imbatível|mega|maluc|imperdível|super oferta/.test(n))return 'impact'
 return 'savings'
}
export const CAMPAIGN_SOUNDS = CAMPAIGN_FAMILIES.filter(f=>f!=='boom').map(f=>({id:`theme-${f}` as `theme-${CampaignFamily}`,name:({bakery:'Forno e crosta crocante',alarm:'Sirene de oferta',lightning:'Trovão e descarga',grill:'Fogo e brasa',clearance:'Queima de estoque',harvest:'Folhagem e água',children:'Estouro divertido',celebration:'Fogos de festa',rose:'Brilho delicado',spooky:'Sopro sombrio',clock:'Relógio e alerta',neon:'Pulso eletrônico',industrial:'Metal e faíscas',show:'Abertura de espetáculo',savings:'Caixa e moedas',impact:'Impacto de arena'} as Record<string,string>)[f]!,seconds:1.6}))
export const campaignFamily=(theme:string):CampaignFamily|undefined=>{const r=recipes.find(r=>r.id===theme);return r?classifyCampaign(r.name,r.sourceProject):undefined}
export const campaignSound=(family:CampaignFamily)=>family==='boom'?'explosion-retail':`theme-${family}` as const
export function campaignStyle(f:CampaignFamily,seed:number){
 const atmosphere={bakery:['dust','bokeh'],boom:['smoke-plumes','embers','spark-burst'],alarm:['shockwave','speed-lines'],lightning:['lightning','laser-sweep'],grill:['fire','embers','smoke-plumes'],clearance:['fire-jets','embers','spark-burst'],harvest:['dust','bokeh'],children:['ribbons','bokeh'],celebration:['ribbons','spark-burst'],rose:['bokeh','ribbons'],spooky:['smoke-plumes','prism'],clock:['orbit','speed-lines'],neon:['grid','laser-sweep'],industrial:['embers','grid'],show:['spotlights','prism'],savings:['bokeh','orbit'],impact:['shockwave','speed-lines']}[f]
 const transition={bakery:'whip-up',boom:'smoke',alarm:'shutter',lightning:'light',grill:'smoke',clearance:'smoke',harvest:'whip-up',children:'spin',celebration:'diagonal',rose:'iris',spooky:'smoke',clock:'iris',neon:'rgb',industrial:'shutter',show:'light',savings:'slide',impact:'snap-zoom'}[f]
 return {atmosphere,transition,accentSound:campaignSound(f),transitionSound:['lightning','neon'].includes(f)?'suction':['grill','clearance','spooky'].includes(f)?'air-swipe':'whip',camera:['boom','alarm','lightning','clearance','impact','industrial'].includes(f)?'earthquake':seed%2?'impact':'swing',product:['grill','clearance','impact','boom'].includes(f)?'slam':seed%2?'whip-left':'rise',text:['impact','alarm','industrial'].includes(f)?'stomp':'word-pop',price:'slam'}
}
