import { shallowRef } from 'vue'

type Message = { message: string; confirm: boolean; resolve: (value: boolean) => void }
export const systemMessage = shallowRef<Message | null>(null)
const queue: Message[] = []
export const closeSystemMessage = (answer: boolean) => {
  const current = systemMessage.value
  systemMessage.value = null
  current?.resolve(answer)
  systemMessage.value = queue.shift() || null
}
const openMessage = (message: string, confirm: boolean): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false)
  return new Promise(resolve => {
    const item = { message: String(message), confirm, resolve }
    if (systemMessage.value) queue.push(item)
    else systemMessage.value = item
  })
}
export const confirmInSystem = (message: string) => openMessage(message, true)
export const alertInSystem = (message: string) => openMessage(message, false)
