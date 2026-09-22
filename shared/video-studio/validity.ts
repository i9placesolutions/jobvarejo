import type {VideoDocument} from './model'
const months=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
function dateParts(value:string){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
 if(!match)return
 const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),date=new Date(Date.UTC(year,month-1,day))
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)return
 return {year,month,day}
}
type VideoDate=NonNullable<ReturnType<typeof dateParts>>
const full=(d:VideoDate)=>`${d.day} de ${months[d.month-1]} de ${d.year}`
function rangeText(start:VideoDate,end:VideoDate){
 if(start.year===end.year&&start.month===end.month&&start.day===end.day)return `Ofertas válidas em ${full(start)}`
 const first=start.year!==end.year?full(start):start.month!==end.month?`${start.day} de ${months[start.month-1]}`:String(start.day)
 return `Ofertas válidas ${first} a ${full(end)}`
}
export function videoValidityText(doc:Pick<VideoDocument,'validity'|'validityRange'>):string{
 const start=dateParts(doc.validityRange?.start||''),end=dateParts(doc.validityRange?.end||'')
 if(start&&end)return rangeText(start,end)
 const text=doc.validity.trim().replace(/\s+/g,' ').replace(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g,(original,day,month,year)=>{
  if(!year)return Number(day)>=1&&Number(day)<=31&&Number(month)>=1&&Number(month)<=12?`${Number(day)} de ${months[Number(month)-1]}`:original
  const date=dateParts(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`)
  return date?full(date):original
 })
 // Modelos antigos guardam a validade como texto, em vez de um intervalo estruturado.
 const range=new RegExp(`^ofertas válidas(?: de)? (\\d{1,2}) de (${months.join('|')}) de (\\d{4}) (?:a|até) (\\d{1,2}) de (${months.join('|')}) de (\\d{4})(?=$|[\\s.,;!])`,'i')
 return text.replace(range,(original,d1,m1,y1,d2,m2,y2)=>{
  const parse=(day:string,month:string,year:string)=>dateParts(`${year}-${String(months.indexOf(month.toLowerCase())+1).padStart(2,'0')}-${day.padStart(2,'0')}`)
  const first=parse(d1,m1,y1),last=parse(d2,m2,y2)
  return first&&last?rangeText(first,last):original
 })
}
