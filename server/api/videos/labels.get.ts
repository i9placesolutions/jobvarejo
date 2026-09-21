import { videoUser } from '../../utils/video-studio/service'
import { listVideoLabels } from '../../utils/video-studio/labels'
export default defineEventHandler(async event=>({items:await listVideoLabels((await videoUser(event)).id)}))
