import {VIDEO_BACKGROUNDS} from '../../../shared/video-studio/backgrounds'
import {VIDEO_THEMES} from '../../../shared/video-studio/model'
import { z } from 'zod'
import { PRODUCT_ENTRANCES, TEXT_ENTRANCES, CAMERA_MOVEMENTS, SCENE_TRANSITIONS, ATMOSPHERE_EFFECTS, SOUND_EFFECTS, PRODUCT_FINISHES } from '../../../shared/video-studio/effect-catalog'
const ids=<T extends readonly {id:string}[]>(items:T)=>items.map(i=>i.id) as [T[number]['id'],...T[number]['id'][]]
const motionSchema=z.object({product:z.enum(ids(PRODUCT_ENTRANCES)),text:z.enum(ids(TEXT_ENTRANCES)),price:z.enum(ids(PRODUCT_ENTRANCES)),camera:z.enum(ids(CAMERA_MOVEMENTS)),atmosphere:z.array(z.enum(ids(ATMOSPHERE_EFFECTS))).max(8).refine(v=>new Set(v).size===v.length),speed:z.enum(['fast','balanced']),transitionSound:z.enum(ids(SOUND_EFFECTS)),accentSound:z.enum(ids(SOUND_EFFECTS)),finish:z.enum(ids(PRODUCT_FINISHES)).optional()})
const text=(max:number,min=0)=>z.string().min(min).max(max).refine(s=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s),'Texto inválido')
const asset=z.union([z.literal(''),z.string().uuid()])
const dateSchema=z.string().max(10).refine(v=>{if(!v)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const date=new Date(v+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===v},'Data inválida')
const transformSchema=z.object({x:z.number().min(-4000).max(4000),y:z.number().min(-4000).max(4000),scale:z.number().min(.1).max(4),rotation:z.number().min(-180).max(180),hidden:z.boolean().optional()})
const elementsSchema=z.record(z.string().regex(/^(seal|logo|name|price|validity|condition|product-[012]|outro-(social|phone|address))$/),transformSchema).refine(v=>Object.keys(v).length<=14)
const scenesSchema=z.record(z.string().regex(/^(intro|outro|[0-9a-f-]{36})$/i),elementsSchema).refine(v=>Object.keys(v).length<=8)
export const videoDocumentSchema=z.object({
 autoFitVoice:z.boolean().optional(),appearance:z.object({currencyColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),nameColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),priceColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),unitColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),conditionColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),validityColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),contactColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),textColor:z.string().regex(/^#[0-9a-f]{6}$/i).optional(),accent:z.string().regex(/^#[0-9a-f]{6}$/i).optional()}).optional(),
 validityRange:z.object({start:dateSchema,end:dateSchema}).optional(),
 layoutEdits:z.object({vertical:scenesSchema.optional(),horizontal:scenesSchema.optional()}).optional(),
 background:z.enum(ids(VIDEO_BACKGROUNDS)).optional(),templateRevision:z.number().int().positive().max(10000).optional(),layoutVersion:z.literal(2).optional(),duplicateProducts:z.boolean().optional(),priceLabel:text(100).optional(),version:z.literal(1),title:text(100,1),theme:z.enum(ids(VIDEO_THEMES)),campaign:text(65,1),
 formats:z.array(z.enum(['vertical','horizontal'])).min(1).max(2).refine(v=>new Set(v).size===v.length),duration:z.union([z.literal(15),z.literal(20),z.literal(30)]),
 brand:z.object({logoStyle:z.enum(['sticker','clean']).optional(),name:text(100),logo:asset,address:text(160),whatsapp:text(45),instagram:text(70),phone:text(60).optional(),facebook:text(100).optional(),website:text(120).optional(),slogan:text(160).optional(),hours:text(160).optional(),paymentNotes:text(180).optional(),addresses:z.array(text(200)).max(8).optional(),whatsappNumbers:z.array(text(80)).max(8).optional()}),validity:text(160),
 offers:z.array(z.object({alcoholBadgeEnabled:z.boolean().optional(),copies:z.union([z.literal(1),z.literal(2),z.literal(3)]).optional(),imageAspectRatio:z.number().min(.05).max(20).optional(),id:z.string().uuid(),name:text(120),price:text(20),unit:text(30),image:asset,condition:text(140)})).max(6).refine(v=>new Set(v.map(o=>o.id)).size===v.length),
 scripts:z.array(z.object({id:text(40),text:text(700)})).max(8).refine(v=>new Set(v.map(o=>o.id)).size===v.length),
 voice:z.object({enabled:z.boolean(),id:text(100),pronunciations:z.array(z.object({from:text(80,1),to:text(120,1)})).max(30)}),
 effects:z.array(z.enum(['shake','smoke','embers','glow','confetti','zoom','bounce','rays','fire','pulse'])).max(10),intensity:z.number().min(0).max(1),transition:z.enum(ids(SCENE_TRANSITIONS)),motion:motionSchema.optional(),
 audio:z.object({music:text(80),musicVolume:z.number().min(0).max(1),voiceVolume:z.number().min(0).max(1),effectsVolume:z.number().min(0).max(1),sounds:z.boolean()})
})
export const videoSaveSchema=z.object({id:z.string().uuid().optional(),revision:z.number().int().nonnegative(),document:videoDocumentSchema,scriptSource:z.string().max(10000)})
