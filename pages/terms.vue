<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})
</script>

<template>
  <div class="w-full max-w-4xl mx-auto py-5 px-2 sm:py-8 sm:px-4">
    <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">Termos de Uso</h1>
    
    <div class="prose max-w-none space-y-6 text-slate-600">
      <section>
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-3">1. Aceitação dos Termos</h2>
        <p>
          Ao acessar e usar o Studio PRO, você concorda em cumprir e estar vinculado aos seguintes termos e condições de uso.
        </p>
      </section>

      <section>
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-3">2. Uso do Serviço</h2>
        <p>
          O Studio PRO é uma plataforma de design e edição. Você é responsável por manter a confidencialidade de sua conta e senha.
        </p>
      </section>

      <section>
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-3">3. Propriedade Intelectual</h2>
        <p>
          Todo o conteúdo criado através do Studio PRO permanece de sua propriedade. Você concede ao Studio PRO uma licença para armazenar e processar seu conteúdo conforme necessário para fornecer o serviço.
        </p>
      </section>

      <section>
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-3">4. Limitação de Responsabilidade</h2>
        <p>
          O Studio PRO não se responsabiliza por perdas ou danos decorrentes do uso ou incapacidade de usar o serviço.
        </p>
      </section>

      <section>
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-3">5. Modificações dos Termos</h2>
        <p>
          Reservamos o direito de modificar estes termos a qualquer momento. As alterações entrarão em vigor imediatamente após a publicação.
        </p>
      </section>
    </div>

    <div class="mt-8 pt-6 border-t border-slate-200">
      <NuxtLink 
        to="/auth/login" 
        class="text-blue-600 hover:text-blue-700 transition-colors"
      >
        ← Voltar para login
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.prose { overflow-wrap: anywhere; line-height: 1.65; }
.prose h2 {
  margin-top: 0;
}
</style>
