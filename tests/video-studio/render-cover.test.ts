import { describe, expect, it } from 'vitest'
import { VIDEO_COVER_FILTER, VIDEO_COVER_FRAME_SECONDS, videoCoverArgs } from '../../workers/video-studio/cover.mjs'

describe('capa do render de vídeo', () => {
  it('extrai um JPEG compacto do quadro inicial estável', () => {
    const args = videoCoverArgs('/tmp/render.mp4', '/tmp/cover.jpg')

    expect(VIDEO_COVER_FRAME_SECONDS).toBe(.45)
    expect(VIDEO_COVER_FILTER).toContain('960:540')
    expect(args).toContain('-c:v')
    expect(args[args.indexOf('-c:v') + 1]).toBe('mjpeg')
    expect(args.at(-1)).toBe('/tmp/cover.jpg')
  })
})
