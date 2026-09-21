// Falha de conexão não comprova perda de posse. A publicação também confere o token.
export async function renewVideoLease(pool, job) {
  try {
    const result = await pool.query("UPDATE public.video_studio_jobs SET lease_until=now()+interval '90 seconds' WHERE id=$1 AND lease_token=$2 AND status='running'", [job.id, job.lease_token])
    return result.rowCount ? 'renewed' : 'lost'
  } catch {
    return 'unavailable'
  }
}
