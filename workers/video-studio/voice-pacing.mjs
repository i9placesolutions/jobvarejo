import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
const exec=promisify(execFile)
export const PACING_VERSION='retail-pauses-v1'
export function silenceIntervals(log,duration){
 const result=[];let start
 for(const match of log.matchAll(/silence_(start|end):\s*([\d.]+)/g)){
  if(match[1]==='start')start=Number(match[2])
  else if(start!==undefined){result.push([start,Number(match[2])]);start=undefined}
 }
 if(start!==undefined)result.push([start,duration])
 return result
}
export function pacingCuts(intervals,duration){
 return intervals.filter(([start,end])=>Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end<=duration+.05&&end-start>=.4).map(([start,end])=>[start<.02?0:start+.09,end>=duration-.05?duration:end-.09]).filter(([start,end])=>end>start)
}
export async function tightenVoicePauses(input,output,duration){
 const {stderr}=await exec('ffmpeg',['-hide_banner','-i',input,'-af','silencedetect=noise=-35dB:d=0.4','-f','null','-'],{timeout:60000,maxBuffer:2*1024*1024})
 const cuts=pacingCuts(silenceIntervals(stderr,duration),duration)
 if(!cuts.length)return {file:input,version:PACING_VERSION,cuts,removedSeconds:0}
 const kept=[];let cursor=0
 for(const [start,end] of cuts){if(start>cursor)kept.push([cursor,start]);cursor=Math.max(cursor,end)}
 if(cursor<duration)kept.push([cursor,duration])
 if(!kept.length)throw Error('A locução recebida não contém fala audível.')
 const filter=kept.map(([start,end],i)=>`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${i}]`).join(';')+';'+kept.map((_,i)=>`[a${i}]`).join('')+`concat=n=${kept.length}:v=0:a=1[out]`
 await exec('ffmpeg',['-y','-v','error','-i',input,'-filter_complex',filter,'-map','[out]','-c:a','libmp3lame','-b:a','320k',output],{timeout:60000,maxBuffer:2*1024*1024})
 return {file:output,version:PACING_VERSION,cuts,removedSeconds:cuts.reduce((sum,[start,end])=>sum+end-start,0)}
}
