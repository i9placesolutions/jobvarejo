import {describe,it,expect} from 'vitest'
import {renderSettings} from '../../workers/video-studio/render-settings.mjs'
describe('render resource limits',()=>{
 it('reserves headroom and caps browser tabs',()=>{expect(renderSettings({},10,16*1024**3)).toEqual({concurrency:4,x264Preset:'veryfast'});expect(renderSettings({},2,4*1024**3).concurrency).toBe(1);expect(renderSettings({},32,6*1024**3).concurrency).toBe(2)})
 it('honors valid operator settings and rejects invalid values',()=>{expect(renderSettings({VIDEO_RENDER_CONCURRENCY:'3',VIDEO_X264_PRESET:'medium'},10,16*1024**3)).toEqual({concurrency:3,x264Preset:'medium'});expect(renderSettings({VIDEO_RENDER_CONCURRENCY:'invalid',VIDEO_X264_PRESET:'bad'},10,16*1024**3)).toEqual({concurrency:4,x264Preset:'veryfast'})})
})
