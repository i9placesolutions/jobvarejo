import { describe, expect, it } from 'vitest'
import { collectProjectColors } from '../../utils/projectColors'
describe('project colors', () => {
  it('collects nested fills, strokes, gradients and character colors without image URLs', () => {
    const group = { type:'Group', objects:[{type:'Rect',fill:'#fff',stroke:'#000'},{type:'Image',src:'https://example.test/image.png'}, {type:'Text',fill:{colorStops:[{color:'#abc'}]},styles:{0:{0:{fill:'#123'}}}}] }
    expect(collectProjectColors([group, {color:'#fff'}])).toEqual(['#fff','#000','#abc','#123'])
  })
  it('reads live canvas groups and ignores transparent paint and cycles', () => {
    const group:any = {getObjects:()=>[{fill:'#f00',stroke:'transparent'}]};group.styles=group
    expect(collectProjectColors([group])).toEqual(['#f00'])
  })
})
