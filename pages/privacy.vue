<script setup lang="ts">
definePageMeta({
  layout: 'auth'
})
</script>

<template>
  <div class="w-full max-w-4xl mx-auto py-5 px-2 sm:py-8 sm:px-4">
    <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">Política de Privacidade</h1>
    
    <div class="prose max-w-none space-y-6 text-slate-600">
      <section>
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-3">1. Informações que Coletamos</h2>
        <p>
          Coletamos informações que você nos fornece diretamente, como nome, endereço de e-mail e conteúdo que você cria usando o Studio PRO.
        </p>
      </section>

      <section>
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-3">2. Como Usamos suas Informações</h2>
        <p>
          Utilizamos suas informações para fornecer, manter e melhorar nossos serviços, processar transações e enviar comunicações relacionadas ao serviço.
        </p>
      </section>

      <section>
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-3">3. Compartilhamento de Informações</h2>
        <p>
          Não vendemos suas informações pessoais. Podemos compartilhar informações apenas com seu consentimento ou conforme exigido por lei.
        </p>
      </section>

      <section>
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-3">4. Segurança</h2>
        <p>
          Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações contra acesso não autorizado, alteração, divulgação ou destruição.
        </p>
      </section>

      <section>
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-3">5. Seus Direitos</h2>
        <p>
          Você tem o direito de acessar, corrigir ou excluir suas informações pessoais a qualquer momento através das configurações da sua conta.
        </p>
      </section>

      <section>
        <h2 class="text-lg sm:text-xl font-semibold text-slate-900 mb-3">6. Alterações nesta Política</h2>
        <p>
          Podemos atualizar esta política de privacidade periodicamente. Notificaremos você sobre mudanças significativas publicando a nova política nesta página.
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
