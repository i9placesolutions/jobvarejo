// Resume existing tasks first. A failed GET or an ambiguous POST never creates another charge.
export async function requestVideoAudio({job,label,payload,type,endpoint,key,checkpoint,isStopping=()=>false,fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms)),pollLimit=150}) {
 const state=job.provider_state||{}
 let record=state[label]
 if(record?.asset)return record.asset
 // A later explicit retry may resume after the account balance is restored.
 if(record?.rejectedHttp===402){record.rejectedHttp=undefined;record.sending=false}
 if(!key)throw Error('A locução não está configurada no servidor.')
 for(let attempt=0;attempt<pollLimit;attempt++){
  if(isStopping())throw Error('Serviço em reinicialização.')
  if(record?.rejectedHttp&&record.rejectedHttp!==429)throw Error(`O serviço de áudio recusou a solicitação (HTTP ${record.rejectedHttp}). Consulte o suporte antes de tentar novamente.`)
  if(record?.sending&&!record.taskId)throw Error('A solicitação de áudio teve resposta incerta. O suporte deve conferir antes de repetir a geração.')
  if(!record?.taskId){
   record=state[label]={...record,sending:true}
   await checkpoint(job,state,5)
   // Do not retry this POST: a transport error does not prove that it was rejected.
   const response=await fetcher(endpoint,{method:'POST',headers:{Authorization:key,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)})
   if(!response.ok){
    record.rejectedHttp=response.status
    if(response.status===402)record.sending=false
    // Only explicit rate-limit rejection is safe to retry automatically.
    if(response.status===429&&(record.rateRetries||0)<2){record.rateRetries=(record.rateRetries||0)+1;record.sending=false;await checkpoint(job,state,5);await sleep(15000);continue}
    await checkpoint(job,state,5)
    throw Error(response.status===402?'O serviço de áudio está sem créditos disponíveis. Os trechos prontos estão salvos.':`O serviço de áudio recusou a solicitação (HTTP ${response.status}). Os trechos prontos estão salvos.`)
   }
   const data=await response.json(),taskId=data.task_id||data.taskId||data.id
   if(!taskId)throw Error('O serviço de áudio não retornou o identificador. Consulte o suporte antes de tentar novamente.')
   record=state[label]={...record,taskId,sending:false,status:'IN_QUEUE',rejectedHttp:undefined}
   await checkpoint(job,state,10)
  }
  const poll=new URL(endpoint);poll.pathname=poll.pathname.replace(/\/[^/]+$/,'/byId');poll.search='';poll.searchParams.set('task_id',record.taskId);poll.searchParams.set('conversionType',type)
  let response,data
  try{response=await fetcher(poll,{headers:{Authorization:key},signal:AbortSignal.timeout(30000)});if(response.ok)data=await response.json()}
  catch{await sleep(4000);continue}
  if(!response.ok){if([401,403,402].includes(response.status))throw Error('O serviço de áudio está indisponível para esta conta. Consulte o suporte.');await sleep(4000);continue}
  const c=data.conversion||data,status=String(c.status||c.state||'').toUpperCase()
  const url=[c.audio_url,c.audioUrl,c.result_url,c.resultUrl,c.output?.url,c.conversion_path_1,c.conversion_path,c.conversion_path_wav_1,c.conversion_path_wav].find(v=>typeof v==='string'&&v.startsWith('https://'))
  if(url)return {url,state,label}
  if(record.status!==status){record.status=status;await checkpoint(job,state,10)}
  if(['TIMEOUT','TIMED_OUT'].includes(status)){
   throw Error('O serviço de áudio excedeu o tempo. Nenhuma nova geração paga foi solicitada automaticamente.')
  }
  if(['FAILED','ERROR','CANCELLED','CANCELED','EXPIRED'].includes(status))throw Error('O serviço de áudio informou falha nesta geração. Os trechos prontos estão salvos.')
  await sleep(4000)
 }
 throw Error('O áudio ainda não ficou pronto. A solicitação está salva e pode ser consultada novamente sem repetir a geração.')
}
