import {beforeEach,describe,it,expect,vi} from 'vitest'
const mocks=vi.hoisted(()=>({user:vi.fn(),brand:vi.fn(),query:vi.fn(),owned:vi.fn(),assets:vi.fn(),body:vi.fn()}))
vi.mock('../../server/utils/video-studio/service',()=>({videoUser:mocks.user,videoJson:JSON.stringify,ownedVideo:mocks.owned,validateVideoAssets:mocks.assets}))
vi.mock('../../server/utils/video-studio/brand',()=>({loadVideoBrand:mocks.brand}))
vi.mock('../../server/utils/postgres',()=>({pgOneOrNull:mocks.query}))
vi.stubGlobal('defineEventHandler',(handler:any)=>handler)
vi.stubGlobal('readBody',mocks.body)
vi.stubGlobal('createError',(data:any)=>Object.assign(new Error(data.statusMessage),data))
const useTemplate=(await import('../../server/api/videos/templates/use.post')).default
const save=(await import('../../server/api/videos/projects/index.post')).default
const {newVideoFromTemplate}=await import('../../shared/video-studio/templates')
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({id:'account-a'});mocks.brand.mockResolvedValue({brand:{name:'Loja A',logo:'logo-a'},warning:''});mocks.query.mockImplementation(async(_sql,params)=>({id:'new-private-id',user_id:params[0],document:JSON.parse(params[2])}));mocks.assets.mockResolvedValue(undefined)})
describe('isolamento e proteção do modelo no servidor',()=>{
 it('cria um novo projeto somente com a marca da sessão e ignora identidade enviada pelo cliente',async()=>{
  mocks.body.mockResolvedValue({theme:'impact',userId:'account-b',brand:{name:'Loja B'},id:'master-id'})
  const result:any=await useTemplate({} as any)
  expect(mocks.brand).toHaveBeenCalledWith('account-a')
  expect(result.project.user_id).toBe('account-a');expect(result.project.document.brand.name).toBe('Loja A')
  expect(result.project.document.offers).toEqual([]);expect(result.project.document.scripts).toEqual([])
  expect(mocks.query.mock.calls[0]![0]).toMatch(/^INSERT/)
  expect(mocks.owned).not.toHaveBeenCalled()
 })
 it('não atualiza um modelo mesmo se o cliente tentar renomeá-lo',async()=>{
  const document=newVideoFromTemplate();document.title='Título comum'
  mocks.body.mockResolvedValue({id:'00000000-0000-4000-8000-000000000001',revision:1,document,scriptSource:''})
  mocks.owned.mockResolvedValue({title:'Quinta — Modelo de demonstração'})
  await expect(save({} as any)).rejects.toMatchObject({statusCode:409})
  expect(mocks.query).not.toHaveBeenCalled()
 })
 it('não permite salvar projeto fora da conta',async()=>{
  mocks.body.mockResolvedValue({id:'00000000-0000-4000-8000-000000000001',revision:1,document:newVideoFromTemplate(),scriptSource:''})
  mocks.owned.mockRejectedValue(Object.assign(new Error('Vídeo não encontrado'),{statusCode:404}))
  await expect(save({} as any)).rejects.toMatchObject({statusCode:404})
  expect(mocks.owned).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001','account-a')
  expect(mocks.query).not.toHaveBeenCalled()
 })
})
