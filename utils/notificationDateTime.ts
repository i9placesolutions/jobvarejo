const formatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

export const formatNotificationDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data indisponível'
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.day}/${parts.month}/${parts.year} às ${parts.hour}:${parts.minute}`
}
