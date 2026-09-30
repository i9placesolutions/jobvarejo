import {resolveCatalogAsset} from '../../workers/video-studio/catalog-assets.mjs'
import {createHash} from 'node:crypto'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const recipesPath='shared/video-studio/generated-flyer-recipes.json'
const templateRoot='public/video-studio/templates'
const outputDirectory=path.join(templateRoot,'video-seals')
const manifestPath='shared/video-studio/video-seals.json'
const alphaThreshold=10
const paddingRatio=0.012
const minAreaSaved=0.02
const transparentPadding=3

const recipes=JSON.parse(await readFile(recipesPath,'utf8'))
const sealReferences=[...new Set(recipes.map(recipe=>recipe.seal).filter(value=>typeof value==='string'&&value.length>0))].sort()
const manifest={version:1,seals:{}}
await mkdir(outputDirectory,{recursive:true})

async function resolveAsset(reference){
  const relative=reference.replace(/^\/+|^\.\//g,'')
  const candidates=[path.join(templateRoot,relative),path.join(templateRoot,path.basename(relative))]
  for(const candidate of candidates){
    const resolved=path.resolve(candidate)
    if(!resolved.startsWith(path.resolve(templateRoot)+path.sep))continue
    try{return {file:resolved,relative:path.relative(templateRoot,resolved).split(path.sep).join('/'),bytes:await readFile(resolved)}}catch(error){if(error.code!=='ENOENT')throw error}
  }
  const file=await resolveCatalogAsset('templates/'+relative)
  return {file,relative,bytes:await readFile(file)}
}

function visibleBounds(data,{width,height,channels}){
  let left=width,top=height,right=-1,bottom=-1
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*channels+channels-1]>alphaThreshold){
    if(x<left)left=x
    if(x>right)right=x
    if(y<top)top=y
    if(y>bottom)bottom=y
  }
  if(right<left||bottom<top)return undefined
  return {left,top,width:right-left+1,height:bottom-top+1}
}

for(const reference of sealReferences){
  const asset=await resolveAsset(reference)
  if(!asset)throw new Error(`Selo referenciado sem arquivo local: ${reference}`)
  const {data,info}=await sharp(asset.bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  const bounds=visibleBounds(data,info)
  if(!bounds)throw new Error(`Selo totalmente transparente: ${reference}`)
  const padX=Math.max(2,Math.ceil(bounds.width*paddingRatio))
  const padY=Math.max(2,Math.ceil(bounds.height*paddingRatio))
  const cropLeft=Math.max(0,bounds.left-padX)
  const cropTop=Math.max(0,bounds.top-padY)
  const cropRight=Math.min(info.width,bounds.left+bounds.width+padX)
  const cropBottom=Math.min(info.height,bounds.top+bounds.height+padY)
  const extractedWidth=cropRight-cropLeft
  const extractedHeight=cropBottom-cropTop
  const outputWidth=extractedWidth+transparentPadding*2
  const outputHeight=extractedHeight+transparentPadding*2
  const savedArea=1-(outputWidth*outputHeight)/(info.width*info.height)
  if(savedArea<minAreaSaved)continue
  const outputBytes=await sharp(asset.bytes)
    .extract({left:cropLeft,top:cropTop,width:extractedWidth,height:extractedHeight})
    .extend({left:transparentPadding,top:transparentPadding,right:transparentPadding,bottom:transparentPadding,background:{r:0,g:0,b:0,alpha:0}})
    .png()
    .toBuffer()
  const digest=createHash('sha256').update(reference).digest('hex').slice(0,8)
  const stem=path.basename(reference,path.extname(reference))
  const filename=`video-seals/${stem}-trimmed-${digest}-v1.png`
  const destination=path.join(templateRoot,filename)
  const outputMeta=await sharp(outputBytes).metadata()
  const record={filename,sealAspect:outputMeta.width/outputMeta.height,source:asset.relative,sourceSize:[info.width,info.height],alphaThreshold,visibleBounds:bounds,cropBounds:{left:cropLeft,top:cropTop,width:extractedWidth,height:extractedHeight},padding:{sourceX:padX,sourceY:padY,transparent:transparentPadding},sha256:createHash('sha256').update(outputBytes).digest('hex')}
  manifest.seals[reference]=record
  let existing
  try{existing=await readFile(destination)}catch(error){if(error.code!=='ENOENT')throw error}
  if(!existing||!existing.equals(outputBytes))await writeFile(destination,outputBytes)
}

const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n')
let oldManifest
try{oldManifest=await readFile(manifestPath)}catch(error){if(error.code!=='ENOENT')throw error}
if(!oldManifest||!oldManifest.equals(manifestBytes))await writeFile(manifestPath,manifestBytes)

console.log(`Selos analisados: ${sealReferences.length}; derivados: ${Object.keys(manifest.seals).length}`)
