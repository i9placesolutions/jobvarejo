<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})
</script>

<template>
  <div class="w-full max-w-4xl mx-auto py-8 px-4">
    <h1 class="text-3xl font-bold text-zinc-900 mb-6">Termos de Uso</h1>
    
    <div class="prose max-w-none space-y-6 text-zinc-700 prose-headings:text-zinc-900">
      <section>
        <h2 class="text-xl font-semibold text-zinc-900 mb-3">1. Aceitação dos Termos</h2>
        <p>
          Ao acessar e usar o Job Varejo, você concorda em cumprir e estar vinculado aos seguintes termos e condições de uso.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-zinc-900 mb-3">2. Uso do Serviço</h2>
        <p>
          O Job Varejo é uma plataforma de design e edição. Você é responsável por manter a confidencialidade de sua conta e senha.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-zinc-900 mb-3">3. Propriedade Intelectual</h2>
        <p>
          Todo o conteúdo criado através do Job Varejo permanece de sua propriedade. Você concede ao Job Varejo uma licença para armazenar e processar seu conteúdo conforme necessário para fornecer o serviço.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-zinc-900 mb-3">4. Limitação de Responsabilidade</h2>
        <p>
          O Job Varejo não se responsabiliza por perdas ou danos decorrentes do uso ou incapacidade de usar o serviço.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-zinc-900 mb-3">5. Modificações dos Termos</h2>
        <p>
          Reservamos o direito de modificar estes termos a qualquer momento. As alterações entrarão em vigor imediatamente após a publicação.
        </p>
      </section>
    </div>

    <div class="mt-8 pt-6 border-t border-zinc-200">
      <NuxtLink 
        to="/auth/login" 
        class="text-[#b3261e] hover:text-[#8f1e19] transition-colors"
      >
        ← Voltar para login
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.prose h2 {
  margin-top: 0;
}
</style>
