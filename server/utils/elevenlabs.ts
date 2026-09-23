import { createHash } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { createElevenClone, createRetailMusic, createRetailSpeech, elevenCloneName, findElevenClone, ELEVEN_MUSIC_MODEL, ELEVEN_RETAIL_MODEL } from '../../shared/elevenlabs-retail.mjs'
import { getS3Client } from './s3'
import { getRadioStorageConfig, isRadioStorageKey, jsonParam } from './radio-indoor'
import { getPostgresPool, pgTx } from './postgres'

export const getElevenLabsConfig = () => ({ apiKey: String(process.env.ELEVENLABS_API_KEY || '').trim() })

export async function ensureElevenLabsVoice(ownerUserId: string, profileId: string) {
  const { apiKey } = getElevenLabsConfig()
  if (!apiKey) throw createError({ statusCode: 503, statusMessage: 'Configure ELEVENLABS_API_KEY no servidor.' })
  const client = await getPostgresPool().connect()
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [`elevenlabs:${profileId}`])
    const row = (await client.query<any>(
      `select name, sample_storage_key, sample_content_type, metadata from public.radio_voice_profiles
        where id=$1 and user_id=$2 and status='active' and consent_status='confirmed'`,
      [profileId, ownerUserId]
    )).rows[0]
    if (!row || !String(row.sample_storage_key || '').startsWith(`radio-indoor/voices/${ownerUserId}/`)) {
      throw createError({ statusCode: 404, statusMessage: 'Amostra de voz não encontrada nesta conta.' })
    }
    const { bucket } = getRadioStorageConfig()
    const source = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: row.sample_storage_key }))
    if (Number(source.ContentLength) > 25 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Amostra maior que 25 MB.' })
    const sample = Buffer.from(await source.Body!.transformToByteArray())
    if (!sample.length || sample.length > 25 * 1024 * 1024) throw createError({ statusCode: 422, statusMessage: 'Amostra de voz inválida.' })
    const sha256 = createHash('sha256').update(sample).digest('hex')
    const previous = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
    if (previous.sourceSha256 && previous.sourceSha256 !== sha256) throw createError({ statusCode: 422, statusMessage: 'Amostra diferente do arquivo original.' })
    if (previous.elevenLabsVoiceId && previous.elevenLabsSampleSha256 === sha256) return { voiceId: String(previous.elevenLabsVoiceId), sampleSha256: sha256 }
    const name = elevenCloneName(profileId, row.name, sha256)
    const recovered = await findElevenClone(apiKey, name)
    if (!recovered && previous.elevenLabsClonePending === sha256) throw createError({ statusCode: 409, statusMessage: 'A criação anterior da voz teve resposta incerta. Confira a conta ElevenLabs antes de repetir.' })
    const clone = recovered ? { voiceId: recovered, created: false, requiresVerification: false } : await createElevenClone({
      apiKey, name, sample,
      filename: String(row.sample_storage_key).split('/').at(-1) || 'voice.mp3',
      mimeType: row.sample_content_type || 'audio/mpeg',
      beforeCreate: async () => {
        await client.query(`update public.radio_voice_profiles set metadata=coalesce(metadata,'{}'::jsonb) || $1::jsonb where id=$2 and user_id=$3`, [jsonParam({ elevenLabsClonePending: sha256 }), profileId, ownerUserId])
      }
    })
    const metadata = { ...previous, elevenLabsVoiceId: clone.voiceId, elevenLabsSampleSha256: sha256, elevenLabsCloneCreatedAt: new Date().toISOString() }
    delete metadata.elevenLabsClonePending
    await client.query('update public.radio_voice_profiles set metadata=$1::jsonb,updated_at=now() where id=$2 and user_id=$3', [jsonParam(metadata), profileId, ownerUserId])
    if (clone.requiresVerification) throw createError({ statusCode: 409, statusMessage: 'A ElevenLabs exige verificação desta voz antes de gerar.' })
    return { voiceId: clone.voiceId, sampleSha256: sha256 }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [`elevenlabs:${profileId}`]).catch(() => undefined)
    client.release()
  }
}

export async function generateElevenLabsRadioSpeech(input: { ownerUserId: string; requestId: string; stationId: string | null; title: string; text: string; voiceId: string; kind: string }) {
  const { apiKey } = getElevenLabsConfig()
  if (!apiKey) throw createError({ statusCode: 503, statusMessage: 'ElevenLabs não configurada.' })
  const speech = await createRetailSpeech({ apiKey, voiceId: input.voiceId, text: input.text })
  const storageKey = `radio-indoor/generated/${input.ownerUserId}/${input.requestId}.mp3`
  if (!isRadioStorageKey(storageKey)) throw createError({ statusCode: 500, statusMessage: 'Chave de áudio gerado inválida.' })
  const { bucket } = getRadioStorageConfig()
  await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: speech.bytes, ContentType: 'audio/mpeg', Metadata: { source: 'elevenlabs', requestId: input.requestId } }))
  await pgTx(async client => {
    await client.query(`update public.radio_requests set status='ready',provider='elevenlabs',provider_task_id=$1,result_storage_key=$2,result_format='mp3',error=null,metadata=metadata || $3::jsonb,updated_at=now() where id=$4 and user_id=$5`, [speech.requestId, storageKey, jsonParam({ elevenLabsModel: ELEVEN_RETAIL_MODEL, elevenLabsVoiceId: input.voiceId }), input.requestId, input.ownerUserId])
    await client.query(`insert into public.radio_catalog_tracks
      (user_id,station_id,title,artist,album,genre,language,duration_ms,source_url,source_provider,source_id,storage_key,audio_format,audio_codec,rights_status,status,metadata)
      values ($1,$2,$3,'ElevenLabs','Solicitações da Rádio Indoor','AI','pt-BR',null,null,'elevenlabs',$4,$5,'mp3',null,'provider-generated','ready',$6::jsonb)
      on conflict (user_id,source_provider,source_id) do update set station_id=excluded.station_id,title=excluded.title,storage_key=excluded.storage_key,status='ready',metadata=excluded.metadata,updated_at=now()`,
    [input.ownerUserId, input.stationId, input.title.slice(0,240), input.requestId, storageKey, jsonParam({ kind: input.kind, generatedBy: 'elevenlabs', model: ELEVEN_RETAIL_MODEL })])
  })
  return { storageKey, bytes: speech.bytes.length, requestId: speech.requestId }
}

export async function generateElevenLabsRadioMusic(input: { ownerUserId: string; requestId: string; stationId: string | null; title: string; brief: string; style: string | null; lyrics: string | null; kind: 'jingle' | 'music' }) {
  const { apiKey } = getElevenLabsConfig()
  if (!apiKey) throw createError({ statusCode: 503, statusMessage: 'Configure ELEVENLABS_API_KEY no servidor.' })
  const music = await createRetailMusic({ apiKey, kind: input.kind, brief: input.brief, style: input.style, lyrics: input.lyrics })
  const storageKey = `radio-indoor/generated/${input.ownerUserId}/${input.requestId}.mp3`
  if (!isRadioStorageKey(storageKey)) throw createError({ statusCode: 500, statusMessage: 'Chave de áudio gerado inválida.' })
  const { bucket } = getRadioStorageConfig()
  await getS3Client().send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: music.bytes, ContentType: 'audio/mpeg', Metadata: { source: 'elevenlabs', requestId: input.requestId } }))
  await pgTx(async client => {
    await client.query(`update public.radio_requests set status='ready',provider='elevenlabs',provider_task_id=$1,result_storage_key=$2,result_format='mp3',error=null,metadata=metadata || $3::jsonb,updated_at=now() where id=$4 and user_id=$5`,
      [music.songId || music.requestId, storageKey, jsonParam({ elevenLabsModel: ELEVEN_MUSIC_MODEL, elevenLabsSongId: music.songId, elevenLabsRequestId: music.requestId }), input.requestId, input.ownerUserId])
    await client.query(`insert into public.radio_catalog_tracks
      (user_id,station_id,title,artist,album,genre,language,duration_ms,source_url,source_provider,source_id,storage_key,audio_format,audio_codec,rights_status,status,metadata)
      values ($1,$2,$3,'ElevenLabs','Solicitações da Rádio Indoor','AI','pt-BR',null,null,'elevenlabs',$4,$5,'mp3',null,'provider-generated','ready',$6::jsonb)
      on conflict (user_id,source_provider,source_id) do update set station_id=excluded.station_id,title=excluded.title,storage_key=excluded.storage_key,status='ready',metadata=excluded.metadata,updated_at=now()`,
      [input.ownerUserId, input.stationId, input.title.slice(0, 240), input.requestId, storageKey, jsonParam({ kind: input.kind, generatedBy: 'elevenlabs', model: ELEVEN_MUSIC_MODEL })])
  })
  return { storageKey, bytes: music.bytes.length, songId: music.songId }
}
