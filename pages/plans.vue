<script setup lang="ts">
import {
  Sparkles,
  Check,
  ShieldCheck,
  CreditCard,
  QrCode,
  ArrowRight,
  Radio,
  LayoutTemplate,
  WandSparkles,
  Calendar,
  Zap,
  HelpCircle,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: 'auth',
  ssr: false
})

const auth = useAuth()
const { getApiAuthHeaders } = useApiAuth()

const profile = ref<any>(null)
const isLoading = ref(true)
const selectedCycle = ref<'monthly' | 'yearly'>('monthly')
const checkoutLoading = ref<string | null>(null)
const checkoutSuccessModal = ref(false)
const selectedPlanForModal = ref<any>(null)

// Cálculos de dias restantes de teste
const trialDaysLeft = computed(() => {
  if (!profile.value?.trial_ends_at) return 0
  const end = new Date(profile.value.trial_ends_at).getTime()
  const now = Date.now()
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  return Math.max(0, diff)
})

const isTrialActive = computed(() => {
  return profile.value?.subscription_status === 'trial' || trialDaysLeft.value > 0
})

const selectedModules = computed<string[]>(() => {
  const mods = profile.value?.selected_modules
  if (Array.isArray(mods)) return mods
  return ['encartes', 'cartazes', 'radio']
})

const plans = [
  {
    id: 'starter_encartes',
    module: 'encartes',
    name: 'Encartes & Ofertas',
    eyebrow: 'Para encartes e redes sociais',
    icon: LayoutTemplate,
    priceMonthly: 79,
    priceYearly: 69,
    description: 'Crie e baixe encartes profissionais em segundos com modelos prontos para o varejo.',
    features: [
      'Modelos ilimitados de encartes',
      'Exportação em alta resolução (PNG, PDF, WhatsApp)',
      'Gerador de inteligência artificial',
      'Banco de imagens de produtos',
      'Logo e dados da sua loja automáticos',
      'Suporte prioritário via WhatsApp'
    ],
    popular: false,
    color: 'from-blue-600 to-indigo-600'
  },
  {
    id: 'starter_cartazes',
    module: 'cartazes',
    name: 'Cartazista Digital',
    eyebrow: 'Para o ponto de venda',
    icon: WandSparkles,
    priceMonthly: 69,
    priceYearly: 59,
    description: 'Cartazes de ofertas para imprimir na hora com tabelas de preços e splashes promocionais.',
    features: [
      'Formatos prontos para impressão (A3, A4, A5)',
      'Preços de atacarejo, unidades e kits',
      'Splashes promocionais customizados',
      'Importação rápida de listas de ofertas',
      'Layouts modernos de supermercado e farmácia',
      'Exportação direta para PDF de alta fidelidade'
    ],
    popular: false,
    color: 'from-amber-600 to-orange-600'
  },
  {
    id: 'starter_radio',
    module: 'radio',
    name: 'Rádio Indoor',
    eyebrow: 'Comunicação sonora no ponto de venda',
    icon: Radio,
    priceMonthly: 89,
    priceYearly: 79,
    description: 'Músicas selecionadas, locuções e jingles programados para animar a sua loja o dia todo.',
    features: [
      'Playlists musicais comerciais sem propaganda externa',
      'Locuções personalizadas geradas com IA',
      'Agendamento automático de blocos de ofertas',
      'Transmissão contínua para PC, tablet ou celular',
      'Troca automática de grade por horário e dia',
      'Módulo exclusivo de jingles e vinhetas'
    ],
    popular: false,
    color: 'from-emerald-600 to-teal-600'
  },
  {
    id: 'pro_combo',
    module: 'combo',
    name: 'Plano Completo Varejo 360',
    eyebrow: 'Todos os módulos integrados',
    icon: Sparkles,
    priceMonthly: 149,
    priceYearly: 129,
    description: 'A solução definitiva para o seu mercado: Encartes, Cartazes e Rádio Indoor trabalhando juntos.',
    features: [
      'Acesso total aos Encartes e Redes',
      'Acesso total ao Cartazista Digital PDV',
      'Acesso total à Rádio Indoor & Locuções com IA',
      'Estúdio de Vídeos para Reels & TV Indoor',
      'Armazenamento prioritário de marcas e campanhas',
      'Atendimento VIP com especialista de varejo'
    ],
    popular: true,
    color: 'from-indigo-600 via-blue-600 to-emerald-600'
  }
]

const loadProfile = async () => {
  isLoading.value = true
  try {
    const headers = await getApiAuthHeaders()
    profile.value = await $fetch('/api/profile', { headers, query: { self: '1' } })
  } catch (e) {
    console.error('Erro ao carregar dados do perfil:', e)
  } finally {
    isLoading.value = false
  }
}

const handleSelectPlan = (plan: any) => {
  selectedPlanForModal.value = plan
  checkoutSuccessModal.value = true
}

const closeCheckoutModal = () => {
  checkoutSuccessModal.value = false
  selectedPlanForModal.value = null
}

onMounted(() => {
  void loadProfile()
})
</script>

<template>
  <div class="plans-page min-h-screen bg-[#f7f9fc] text-[#172b45] font-sans flex flex-col">
    <!-- Header -->
    <header class="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-3">
          <img src="/img/jobvarejo-logo-trim.png" alt="JobVarejo" class="h-8 w-auto">
        </NuxtLink>

        <div class="flex items-center gap-3">
          <NuxtLink
            to="/"
            class="text-xs font-semibold px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            Voltar ao Painel
          </NuxtLink>
          <NuxtLink
            to="/profile"
            class="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
          >
            Minha Conta
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-10 w-full">
      <!-- Trial Status Banner -->
      <div
        v-if="isTrialActive"
        class="mb-10 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

        <div class="relative z-10 max-w-2xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold mb-3 tracking-wide uppercase">
            <Clock class="w-3.5 h-3.5" />
            Período de Testes Ativo
          </div>
          <h2 class="text-2xl sm:text-3xl font-black tracking-tight mb-2">
            Você tem {{ trialDaysLeft }} {{ trialDaysLeft === 1 ? 'dia' : 'dias' }} de teste grátis liberados!
          </h2>
          <p class="text-blue-100 text-sm sm:text-base leading-relaxed">
            Aproveite todas as funcionalidades dos seus módulos selecionados. Garanta a continuidade do seu serviço ativando seu plano sem interrupções.
          </p>
          <div class="mt-4 flex flex-wrap gap-2 text-xs">
            <span class="text-blue-200">Módulos em teste:</span>
            <span
              v-for="mod in selectedModules"
              :key="mod"
              class="px-2.5 py-0.5 rounded-md bg-white/15 font-semibold capitalize"
            >
              {{ mod === 'radio' ? 'Rádio Indoor' : mod }}
            </span>
          </div>
        </div>

        <div class="relative z-10 shrink-0 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center md:min-w-[200px]">
          <span class="block text-xs uppercase tracking-wider text-blue-200 font-bold mb-1">Status do Acesso</span>
          <span class="inline-flex items-center gap-1.5 text-base font-bold text-emerald-300">
            <CheckCircle2 class="w-4 h-4" /> 15 Dias Grátis
          </span>
          <p class="text-[11px] text-blue-100 mt-2">Sem cobrança imediata</p>
        </div>
      </div>

      <!-- Heading -->
      <div class="text-center max-w-3xl mx-auto mb-10">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold tracking-wide uppercase mb-3">
          <Zap class="w-3.5 h-3.5 text-blue-600" />
          Planos e Pagamento
        </span>
        <h1 class="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 mb-4">
          Escolha o plano ideal para impulsionar suas vendas
        </h1>
        <p class="text-slate-600 text-base sm:text-lg">
          Módulos individuais ou a solução completa integrada. Preços acessíveis pensados para pequenos, médios e grandes comércios.
        </p>

        <!-- Billing Cycle Selector -->
        <div class="mt-8 inline-flex items-center bg-slate-200/80 p-1.5 rounded-2xl shadow-inner">
          <button
            type="button"
            @click="selectedCycle = 'monthly'"
            :class="[
              'px-5 py-2 rounded-xl text-xs font-bold transition-all',
              selectedCycle === 'monthly'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            Mensal
          </button>
          <button
            type="button"
            @click="selectedCycle = 'yearly'"
            :class="[
              'px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2',
              selectedCycle === 'yearly'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:text-slate-900'
            ]"
          >
            <span>Anual</span>
            <span class="text-[10px] bg-emerald-500 text-white font-extrabold px-1.5 py-0.5 rounded-full uppercase">
              Economize 20%
            </span>
          </button>
        </div>
      </div>

      <!-- Pricing Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        <div
          v-for="plan in plans"
          :key="plan.id"
          :class="[
            'relative bg-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 border',
            plan.popular
              ? 'border-blue-500 shadow-2xl shadow-blue-500/15 ring-2 ring-blue-500/20 md:-translate-y-2'
              : 'border-slate-200 shadow-sm hover:shadow-lg'
          ]"
        >
          <!-- Badge Popular -->
          <div
            v-if="plan.popular"
            class="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-black uppercase tracking-wider shadow-md"
          >
            Mais Escolhido ★
          </div>

          <div>
            <div class="flex items-center gap-3 mb-4">
              <div :class="['w-10 h-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center shadow-md', plan.color]">
                <component :is="plan.icon" class="w-5 h-5" />
              </div>
              <div>
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">{{ plan.eyebrow }}</span>
                <h3 class="text-lg font-black text-slate-900">{{ plan.name }}</h3>
              </div>
            </div>

            <p class="text-xs text-slate-500 min-h-[36px] mb-5 leading-relaxed">
              {{ plan.description }}
            </p>

            <!-- Price -->
            <div class="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div class="flex items-baseline gap-1">
                <span class="text-xs font-semibold text-slate-500">R$</span>
                <span class="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  {{ selectedCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly }}
                </span>
                <span class="text-xs font-semibold text-slate-500">/mês</span>
              </div>
              <span class="text-[11px] text-slate-400 block mt-1">
                {{ selectedCycle === 'monthly' ? 'Cobrado mensalmente' : 'Cobrança anual com desconto' }}
              </span>
            </div>

            <!-- Features -->
            <div class="space-y-2.5 mb-8">
              <span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">O que inclui:</span>
              <div
                v-for="feature in plan.features"
                :key="feature"
                class="flex items-start gap-2.5 text-xs text-slate-700"
              >
                <Check class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{{ feature }}</span>
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              @click="handleSelectPlan(plan)"
              :class="[
                'w-full py-3.5 px-4 rounded-xl text-xs font-black tracking-wide uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm',
                plan.popular
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30 hover:shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              ]"
            >
              <span>Contratar Plano</span>
              <ArrowRight class="w-4 h-4" />
            </button>
            <p class="text-[10px] text-center text-slate-400 mt-2">
              PIX ou Cartão • Sem fidelidade
            </p>
          </div>
        </div>
      </div>

      <!-- Payment Methods & Security -->
      <div class="mt-14 p-8 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck class="w-6 h-6" />
          </div>
          <div>
            <h4 class="text-base font-bold text-slate-900">Pagamento Seguro & Instantâneo</h4>
            <p class="text-xs text-slate-500">Seus dados protegidos com criptografia ponta a ponta. Liberação imediata.</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-4 text-slate-600 text-xs font-semibold">
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100">
            <QrCode class="w-4 h-4 text-emerald-600" />
            <span>PIX com ativação imediata</span>
          </div>
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100">
            <CreditCard class="w-4 h-4 text-blue-600" />
            <span>Cartão de Crédito até 12x</span>
          </div>
        </div>
      </div>

      <!-- FAQ Section -->
      <section class="mt-14 max-w-4xl mx-auto">
        <h2 class="text-2xl font-black text-slate-900 text-center mb-8 flex items-center justify-center gap-2">
          <HelpCircle class="w-6 h-6 text-blue-600" />
          Dúvidas Frequentes
        </h2>

        <div class="grid gap-4">
          <div class="p-5 rounded-2xl bg-white border border-slate-200">
            <h3 class="text-sm font-bold text-slate-900 mb-1">Como funciona o período de 15 dias de teste grátis?</h3>
            <p class="text-xs text-slate-600 leading-relaxed">
              Você pode usar os módulos que selecionou no cadastro sem qualquer cobrança durante 15 dias. Não é necessário cadastrar cartão para testar. Ao final do período, você escolhe se deseja continuar ativando um plano.
            </p>
          </div>

          <div class="p-5 rounded-2xl bg-white border border-slate-200">
            <h3 class="text-sm font-bold text-slate-900 mb-1">Posso mudar de plano ou cancelar a qualquer momento?</h3>
            <p class="text-xs text-slate-600 leading-relaxed">
              Sim! Nossos planos não têm contrato de fidelidade. Você pode fazer upgrade, downgrade ou cancelamento direto no painel com apenas um clique.
            </p>
          </div>

          <div class="p-5 rounded-2xl bg-white border border-slate-200">
            <h3 class="text-sm font-bold text-slate-900 mb-1">A rádio indoor precisa de internet de alta velocidade?</h3>
            <p class="text-xs text-slate-600 leading-relaxed">
              Não. O player é otimizado para consumir pouquíssima banda e conta com cache inteligente de faixas para garantir que a música da sua loja nunca sofra interrupções.
            </p>
          </div>
        </div>
      </section>
    </main>

    <!-- Modal de Checkout / Pagamento -->
    <div
      v-if="checkoutSuccessModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div class="plans-checkout-dialog max-h-[calc(100dvh-2rem)] min-w-0 w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl relative animate-in fade-in zoom-in duration-150 sm:p-8">
        <button
          type="button"
          @click="closeCheckoutModal"
          class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-sm font-bold p-2"
        >
          ✕
        </button>

        <div class="text-center mb-6">
          <div class="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <CreditCard class="w-7 h-7" />
          </div>
          <h3 class="text-xl font-black text-slate-900">Finalizar Assinatura</h3>
          <p class="text-xs text-slate-500 mt-1">
            Você selecionou o plano <strong>{{ selectedPlanForModal?.name }}</strong>
          </p>
        </div>

        <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-6">
          <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-semibold text-slate-600">Ciclo selecionado:</span>
            <span class="text-xs font-bold text-slate-900 capitalize">{{ selectedCycle === 'monthly' ? 'Mensal' : 'Anual' }}</span>
          </div>
          <div class="flex justify-between items-center text-sm font-bold border-t border-slate-200 pt-2">
            <span class="text-slate-800">Total a pagar:</span>
            <span class="text-blue-600 text-lg">
              R$ {{ selectedCycle === 'monthly' ? selectedPlanForModal?.priceMonthly : (selectedPlanForModal?.priceYearly * 12) }}
            </span>
          </div>
        </div>

        <div class="space-y-3 mb-6">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-400">Escolha a forma de pagamento:</label>
          <div class="plans-checkout-options grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            <button
              type="button"
              class="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 flex flex-col items-center gap-2 text-emerald-800 font-bold text-xs"
            >
              <QrCode class="w-6 h-6 text-emerald-600" />
              <span>PIX Instantâneo</span>
            </button>
            <button
              type="button"
              class="p-4 rounded-xl border border-slate-200 hover:border-blue-500 bg-white flex flex-col items-center gap-2 text-slate-700 font-bold text-xs"
            >
              <CreditCard class="w-6 h-6 text-blue-600" />
              <span>Cartão de Crédito</span>
            </button>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 leading-relaxed mb-6">
          ℹ️ Sua loja já possui os <strong>15 dias gratuitos</strong> ativados. Se preferir, você pode continuar usando normalmente e efetuar a ativação a qualquer momento antes do término do prazo.
        </div>

        <div class="plans-checkout-actions flex flex-col gap-3 min-[420px]:flex-row">
          <button
            type="button"
            @click="closeCheckoutModal"
            class="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            Continuar no Teste Grátis
          </button>
          <a
            href="https://wa.me/5511999999999?text=Olá,%20gostaria%20de%20ativar%20meu%20plano%20do%20JobVarejo"
            target="_blank"
            class="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            <span>Falar com Consultor</span>
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plans-page {
  font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
}
</style>
