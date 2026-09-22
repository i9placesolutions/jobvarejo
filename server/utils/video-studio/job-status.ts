import { pgQuery } from '../postgres'

// Only public progress is returned; provider identifiers and payloads stay on the server.
export async function videoJobStatus(userId: string, projectId: string) {
  const { rows } = await pgQuery(`SELECT id,revision,kind,status,fingerprint,result,progress,error,created_at,
    (SELECT count(*)::int FROM jsonb_each(COALESCE(provider_state,'{}'::jsonb)) entry WHERE entry.value ? 'asset') AS completed_clips,
    CASE WHEN payload->>'voiceMode'='full-v1' THEN 1 WHEN kind='voice' THEN jsonb_array_length(payload->'document'->'scripts') ELSE 1 END AS total_clips
    FROM public.video_studio_jobs WHERE user_id=$1 AND project_id=$2 ORDER BY created_at DESC LIMIT 40`, [userId, projectId])
  return { items: rows.map(row => ({ ...row, error: row.error ? (/crédit|saldo|cobran|paga|HTTP|configur|conta|provedor|MusicGPT/i.test(row.error) ? 'Não foi possível concluir a geração agora. Seu projeto e os áudios prontos estão salvos.' : row.error) : null })) }
}
