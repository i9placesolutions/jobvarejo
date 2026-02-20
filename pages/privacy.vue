<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})
</script>

<template>
  <div class="w-full max-w-4xl mx-auto py-8 px-4">
    <h1 class="text-3xl font-bold text-zinc-900 mb-6">Política de Privacidade</h1>
    
    <div class="prose max-w-none space-y-6 text-zinc-700 prose-headings:text-zinc-900">
      <section>
        <h2 class="text-xl font-semibold text-zinc-900 mb-3">1. Informações que Coletamos</h2>
        <p>
          Coletamos informações que você nos fornece diretamente, como nome, endereço de e-mail e conteúdo que você cria usando o Job Varejo.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-zinc-900 mb-3">2. Como Usamos suas Informações</h2>
        <p>
          Utilizamos suas informações para fornecer, manter e melhorar nossos serviços, processar transações e enviar comunicações relacionadas ao serviço.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-zinc-900 mb-3">3. Compartilhamento de Informações</h2>
        <p>
          Não vendemos suas informações pessoais. Podemos compartilhar informações apenas com seu consentimento ou conforme exigido por lei.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-zinc-900 mb-3">4. Segurança</h2>
        <p>
          Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações contra acesso não autorizado, alteração, divulgação ou destruição.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-zinc-900 mb-3">5. Seus Direitos</h2>
        <p>
          Você tem o direito de acessar, corrigir ou excluir suas informações pessoais a qualquer momento através das configurações da sua conta.
        </p>
      </section>

      <section>
        <h2 class="text-xl font-semibold text-zinc-900 mb-3">6. Alterações nesta Política</h2>
        <p>
          Podemos atualizar esta política de privacidade periodicamente. Notificaremos você sobre mudanças significativas publicando a nova política nesta página.
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
