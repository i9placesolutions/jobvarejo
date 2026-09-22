import { videoUser } from '../../utils/video-studio/service'
import { listVideoLabels } from '../../utils/video-studio/labels'
export default defineEventHandler(async event=>{
 const user=await videoUser(event)
 const query=getQuery(event)
 const labelId=typeof query.id==='string'?query.id.slice(0,128):undefined
 return {items:await listVideoLabels(user.id,labelId)}
})
