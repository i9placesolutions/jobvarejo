export function renewVideoLease(
  pool: {query(sql: string, values: string[]): Promise<{rowCount: number | null}>},
  job: {id: string; lease_token: string},
): Promise<'renewed' | 'lost' | 'unavailable'>
