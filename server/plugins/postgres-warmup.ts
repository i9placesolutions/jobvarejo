import { pgQuery } from '../utils/postgres'

// A primeira conexão SSL com o PostgreSQL remoto custa bem mais do que as
// consultas da galeria. Abra o pool enquanto o servidor inicia para que a
// primeira tela autenticada não pague esse tempo de conexão.
export default defineNitroPlugin(async () => {
  try {
    await pgQuery('select 1')
  } catch (error: any) {
    // A rota continua reportando o erro real de banco se ele persistir. Não
    // impedir o processo de subir mantém o comportamento de recuperação atual.
    console.warn('⚠️ [postgres] Não foi possível aquecer a conexão na inicialização', {
      message: error?.message || String(error)
    })
  }
})
