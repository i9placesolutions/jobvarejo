import { describe, expect, it } from 'vitest'
import { prepareNeutralFlyerCanvas, removeFlyerAccountContacts } from '../../utils/flyerGalleryPreview'

describe('safe gallery composition', () => {
  const source = { objects: [
    {type:'Group',objects:[{businessProfileField:'whatsapp',text:'private contact'},{businessProfileField:'logo',_customId:'logo',quickLogoBackdropId:'backdrop',src:'private logo'}]},
    {name:'header-logo-legacy',src:'legacy logo'},
    {name:'footer-dynamic-address',text:'private address'},
    {_customId:'backdrop',quickLogoBackdropOwnerId:'logo'},
    {name:'campaign-title',text:'Super ofertas'},
    {name:'product',text:'Arroz 5kg R$ 19,99'}
  ] }
  it('strips account contact values in nested groups without changing the model or offers', () => {
    const contacts=removeFlyerAccountContacts(source)
    expect(contacts.objects[0].objects).toHaveLength(1)
    expect(contacts.objects[0].objects[0].businessProfileField).toBe('logo')
    expect(JSON.stringify(contacts)).not.toContain('private contact')
    expect(JSON.stringify(contacts)).not.toContain('private address')
    expect(source.objects[0]?.objects).toHaveLength(2)
  })
  it('also removes dynamic/legacy logos and associated backdrop for the shared thumbnail', () => {
    const canvas=prepareNeutralFlyerCanvas(source)
    expect(canvas.objects[0].objects).toEqual([])
    expect(JSON.stringify(canvas)).not.toContain('logo')
    expect(JSON.stringify(canvas)).not.toContain('backdrop')
    expect(canvas.objects.map((o:any)=>o.text).filter(Boolean)).toEqual(['Super ofertas','Arroz 5kg R$ 19,99'])
  })
})
