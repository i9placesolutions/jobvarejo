import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
const root=resolve(import.meta.dirname,'../..')
const pkg=JSON.parse(await readFile(resolve(root,'node_modules/@remotion/effects/package.json'),'utf8'))
const workerPkg=JSON.parse(await readFile(resolve(root,'workers/video-studio/node_modules/@remotion/effects/package.json'),'utf8'))
if(pkg.version!==workerPkg.version)throw Error('Versões diferentes entre a prévia e o worker.')
const integrated=new Set(['shine','glow','chromaticAberration','zoomBlur','outline','lightLeak','starburst'])
const resources=[]
for(const key of Object.keys(pkg.exports)){
 if(key==='.'||key.endsWith('package.json'))continue
 const path='@remotion/effects/'+key.slice(2),mod=await import(path)
 const factories=Object.entries(mod).filter(([,v])=>typeof v==='function').map(([name])=>name)
 for(const name of factories)resources.push({name,module:path,status:integrated.has(name)?'integrated-in-video-library':'installed-callable',reference:`https://www.remotion.dev/docs/effects/${key.slice(2)}`})
}
const report={version:pkg.version,checkedAt:new Date().toISOString(),scope:'Imports reais do pacote inteiro. Apenas os marcados integrated-in-video-library estão ligados aos controles e composições do aplicativo; importável não significa validado visualmente.',resources}
await mkdir(resolve(root,'docs/video-studio'),{recursive:true})
await writeFile(resolve(root,'docs/video-studio/remotion-resources.json'),JSON.stringify(report,null,2)+'\n')
console.log({version:pkg.version,resources:resources.length,integrated:resources.filter(r=>r.status==='integrated-in-video-library').length})
