export const VIDEO_BACKGROUNDS=[
 {id:'lava',name:'Lava e fogo',color:'#870d0a'},
 {id:'electric',name:'Azul elétrico',color:'#07359c'},
 {id:'neon',name:'Neon violeta',color:'#420985'},
 {id:'harvest',name:'Verde luminoso',color:'#145c12'},
 {id:'celebration',name:'Festa de cores',color:'#9b235a'},
 {id:'red-gold',name:'Vermelho e ouro',color:'#940d22'},
] as const
export type VideoBackground=typeof VIDEO_BACKGROUNDS[number]['id']
export const videoBackground=(id?:string)=>VIDEO_BACKGROUNDS.find(v=>v.id===id)
export const backgroundAsset=(id:string,format:'vertical'|'horizontal')=>`backgrounds/${id}${format==='vertical'?'-vertical':''}-v1.png`
