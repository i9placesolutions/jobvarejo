const fs=require('fs')
const {parse,compileScript}=require('@vue/compiler-sfc')
const ts=require('typescript')
const src=fs.readFileSync('components/LabelTemplateMiniEditor.vue','utf8')
const {descriptor,errors}=parse(src,{filename:'LabelTemplateMiniEditor.vue'})
if(errors&&errors.length){console.log('PARSE ERRORS:',errors.map(e=>e.message));process.exit(1)}
let compiled
try{ compiled=compileScript(descriptor,{id:'x'}) }catch(e){ console.log('COMPILE ERROR:',e.message); process.exit(1) }
const out=ts.transpileModule(compiled.content,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020,jsx:undefined}})
const diags=(out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error)
console.log('SFC parse+compile: OK')
console.log('TS syntax diagnostics:', diags.length)
diags.slice(0,10).forEach(d=>console.log(' -', ts.flattenDiagnosticMessageText(d.messageText,'\n')))
