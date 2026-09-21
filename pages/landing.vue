<script setup lang="ts">
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clapperboard,
  Image as ImageIcon,
  LayoutTemplate,
  Menu,
  Play,
  Radio,
  X,
  Zap,
} from 'lucide-vue-next'

definePageMeta({
  layout: false,
  ssr: true,
})

useSeoMeta({
  title: 'JobVarejo — Encartes, vídeos e rádio da sua loja',
  description:
    'Monte as ofertas do seu supermercado, farmácia ou comércio em minutos. Teste grátis por 15 dias.',
  ogTitle: 'JobVarejo — As ofertas da sua loja, prontas pra vender',
  ogDescription: 'Feito pro seu negócio. 15 dias grátis.',
  ogImage: '/img/landing/real/encarte-stories.png',
  twitterCard: 'summary_large_image',
})

const mobileOpen = ref(false)
const openFaq = ref<number | null>(0)
const scrolled = ref(false)

const trialHref = '/auth/register?trial=15'
const loginHref = '/auth/login'

const modules = [
  {
    icon: LayoutTemplate,
    title: 'Encarte da sua semana',
    text: 'Cola a lista, escolhe o modelo e sai o material da sua loja — WhatsApp, impressão ou TV.',
  },
  {
    icon: ImageIcon,
    title: 'Artes do seu negócio',
    text: 'Posts e campanhas com a sua logo, no formato certo pra rede e PDV.',
  },
  {
    icon: Clapperboard,
    title: 'Vídeo das suas ofertas',
    text: 'Reels, Stories e TV em até 30s — do mesmo jeito que você vê no sistema.',
  },
  {
    icon: Radio,
    title: 'Rádio da sua loja',
    text: 'Jingles e offs no corredor, com agenda automática.',
  },
]

const steps = [
  { n: '01', title: 'Coloca a cara da sua loja', text: 'Logo e contatos. Tudo já sai com a sua marca.' },
  { n: '02', title: 'Manda a lista de ofertas', text: 'Do Excel ou do WhatsApp. A IA organiza produto e preço.' },
  { n: '03', title: 'Publica e vende', text: 'Encarte, arte, vídeo e rádio nos canais da sua loja.' },
]

const faqs = [
  {
    q: 'Os 15 dias grátis incluem o quê?',
    a: 'Você usa de verdade: encartes, artes, vídeos e rádio indoor. Sem cartão pra começar.',
  },
  {
    q: 'Preciso saber fazer arte?',
    a: 'Não. Escolhe o modelo, coloca preço e logo. Se quiser mexer mais, tem editor completo.',
  },
  {
    q: 'Serve pra minha loja?',
    a: 'Supermercado, farmácia, hortifruti, açougue, padaria, pet, atacarejo — se tem oferta pra divulgar, serve.',
  },
  {
    q: 'Consigo mandar no WhatsApp e imprimir?',
    a: 'Sim. PNG, PDF e ZIP. Vídeo pra Reels/Stories e pra TV da loja.',
  },
]

const onScroll = () => {
  scrolled.value = window.scrollY > 24
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
})

const toggleFaq = (index: number) => {
  openFaq.value = openFaq.value === index ? null : index
}

const closeMobile = () => {
  mobileOpen.value = false
}
</script>

<template>
  <div class="jv-lp">
    <!-- NAV — estilo limpo da 1ª versão -->
    <header class="jv-nav" :class="{ 'is-scrolled': scrolled }">
      <div class="jv-wrap jv-nav__inner">
        <a href="#topo" class="jv-brand" @click="closeMobile">
          <img
            src="/img/jobvarejo-logo-trim.png"
            alt="JobVarejo"
            class="jv-brand__logo"
            width="200"
            height="64"
          >
        </a>

        <nav class="jv-nav__links" aria-label="Principal">
          <a href="#exemplo">Exemplo</a>
          <a href="#modulos">O que inclui</a>
          <a href="#como">Como funciona</a>
          <a href="#faq">Dúvidas</a>
        </nav>

        <div class="jv-nav__actions">
          <NuxtLink :to="loginHref" class="jv-btn jv-btn--ghost">Entrar</NuxtLink>
          <NuxtLink :to="trialHref" class="jv-btn jv-btn--primary">
            15 dias grátis
            <ArrowRight class="jv-ico" />
          </NuxtLink>
        </div>

        <button
          type="button"
          class="jv-nav__burger"
          :aria-expanded="mobileOpen"
          aria-label="Abrir menu"
          @click="mobileOpen = !mobileOpen"
        >
          <X v-if="mobileOpen" class="jv-ico" />
          <Menu v-else class="jv-ico" />
        </button>
      </div>

      <div v-if="mobileOpen" class="jv-nav__mobile">
        <a href="#exemplo" @click="closeMobile">Exemplo</a>
        <a href="#modulos" @click="closeMobile">O que inclui</a>
        <a href="#como" @click="closeMobile">Como funciona</a>
        <a href="#faq" @click="closeMobile">Dúvidas</a>
        <NuxtLink :to="loginHref" class="jv-btn jv-btn--ghost" @click="closeMobile">Entrar</NuxtLink>
        <NuxtLink :to="trialHref" class="jv-btn jv-btn--primary" @click="closeMobile">15 dias grátis</NuxtLink>
      </div>
    </header>

    <main id="topo">
      <!-- HERO cinematográfico (1ª versão) + copy direto -->
      <section class="jv-hero">
        <div class="jv-hero__media" aria-hidden="true">
          <video
            class="jv-hero__video"
            autoplay
            muted
            loop
            playsinline
            poster="/img/landing/real/video-tv-frame.png"
          >
            <source src="/img/landing/videos/showcase-horizontal.mp4" type="video/mp4">
          </video>
          <div class="jv-hero__scrim" />
        </div>

        <div class="jv-wrap jv-hero__content">
          <p class="jv-eyebrow">
            <Zap class="jv-ico" />
            Feito pro seu negócio
          </p>

          <h1>
            As ofertas da
            <span class="jv-grad">sua loja</span>,
            prontas pra vender
          </h1>

          <p class="jv-hero__lead">
            Encarte, arte, vídeo e rádio indoor — com a cara do
            <strong>seu supermercado</strong>, da
            <strong>sua farmácia</strong>, do
            <strong>seu comércio</strong>.
          </p>

          <div class="jv-hero__cta">
            <NuxtLink :to="trialHref" class="jv-btn jv-btn--primary jv-btn--xl">
              Testar grátis por 15 dias
              <ArrowRight class="jv-ico" />
            </NuxtLink>
            <a href="#exemplo" class="jv-btn jv-btn--glass jv-btn--xl">
              <Play class="jv-ico" />
              Ver um exemplo
            </a>
          </div>

          <ul class="jv-hero__trust">
            <li><Check class="jv-ico" /> Sem cartão</li>
            <li><Check class="jv-ico" /> Sua marca em tudo</li>
            <li><Check class="jv-ico" /> Pronto em minutos</li>
          </ul>
        </div>

        <!-- Só 2 peças no hero — sem poluir -->
        <div class="jv-wrap jv-hero__preview">
          <figure class="jv-preview-card">
            <img
              src="/img/landing/real/encarte-stories.png"
              alt="Exemplo de encarte do JobVarejo"
              width="540"
              height="960"
              loading="eager"
            >
            <figcaption>
              <span class="jv-pill">Encarte</span>
              Exemplo real do sistema
            </figcaption>
          </figure>
          <figure class="jv-preview-card jv-preview-card--video">
            <video
              autoplay
              muted
              loop
              playsinline
              poster="/img/landing/real/video-reels-frame.png"
            >
              <source src="/img/landing/videos/showcase-vertical.mp4" type="video/mp4">
            </video>
            <figcaption>
              <span class="jv-pill jv-pill--blue">Vídeo</span>
              Reels / TV da loja
            </figcaption>
          </figure>
        </div>
      </section>

      <!-- Um único bloco de exemplo (não galeria) -->
      <section id="exemplo" class="jv-section">
        <div class="jv-wrap jv-exemplo">
          <div class="jv-exemplo__copy">
            <p class="jv-eyebrow jv-eyebrow--dark">Na prática</p>
            <h2>Um gostinho do que sai no sistema</h2>
            <p>
              Não é banco de imagem. É o tipo de encarte e vídeo que você monta
              pra <strong>sua loja</strong> — edita preço, coloca logo e publica.
            </p>
            <ul class="jv-exemplo__list">
              <li><Check class="jv-ico" /> Modelos prontos pra editar</li>
              <li><Check class="jv-ico" /> Exporta pra WhatsApp e impressão</li>
              <li><Check class="jv-ico" /> Vídeo vertical e horizontal</li>
            </ul>
            <NuxtLink :to="trialHref" class="jv-btn jv-btn--primary">
              Quero testar na minha loja
              <ArrowRight class="jv-ico" />
            </NuxtLink>
          </div>
          <div class="jv-exemplo__visual">
            <img
              src="/img/landing/real/encarte-stories.png"
              alt="Encarte de ofertas do sistema"
              width="540"
              height="960"
              loading="lazy"
            >
          </div>
        </div>
      </section>

      <!-- Módulos em cards leves — sem repetir todas as imagens -->
      <section id="modulos" class="jv-section jv-section--tint">
        <div class="jv-wrap">
          <div class="jv-section__head">
            <p class="jv-eyebrow jv-eyebrow--dark">O que inclui</p>
            <h2>Tudo que a sua loja precisa pra comunicar preço</h2>
          </div>

          <div class="jv-mod-grid">
            <article v-for="mod in modules" :key="mod.title" class="jv-mod-card">
              <span class="jv-mod-card__icon">
                <component :is="mod.icon" class="jv-ico" />
              </span>
              <h3>{{ mod.title }}</h3>
              <p>{{ mod.text }}</p>
            </article>
          </div>
        </div>
      </section>

      <section id="como" class="jv-section">
        <div class="jv-wrap">
          <div class="jv-section__head jv-section__head--center">
            <p class="jv-eyebrow jv-eyebrow--dark">Simples assim</p>
            <h2>Três passos e a promoção da sua loja tá no ar</h2>
          </div>
          <ol class="jv-steps">
            <li v-for="step in steps" :key="step.n">
              <span>{{ step.n }}</span>
              <h3>{{ step.title }}</h3>
              <p>{{ step.text }}</p>
            </li>
          </ol>
        </div>
      </section>

      <section class="jv-trial">
        <div class="jv-wrap jv-trial__card">
          <div>
            <p class="jv-eyebrow">15 dias na sua conta</p>
            <h2>Abre, cria a oferta da sua loja e sente a diferença</h2>
            <p>Sem cartão. Sem enrolação.</p>
          </div>
          <div>
            <NuxtLink :to="trialHref" class="jv-btn jv-btn--primary jv-btn--xl jv-btn--block">
              Começar meu teste grátis
              <ArrowRight class="jv-ico" />
            </NuxtLink>
            <p class="jv-trial__note">Já tem conta? <NuxtLink :to="loginHref">Entrar</NuxtLink></p>
          </div>
        </div>
      </section>

      <section id="faq" class="jv-section">
        <div class="jv-wrap jv-faq">
          <div class="jv-section__head">
            <p class="jv-eyebrow jv-eyebrow--dark">Dúvidas</p>
            <h2>Perguntas que o dono da loja faz</h2>
          </div>
          <div class="jv-faq__list">
            <div
              v-for="(item, i) in faqs"
              :key="item.q"
              class="jv-faq__item"
              :class="{ 'is-open': openFaq === i }"
            >
              <button type="button" class="jv-faq__q" @click="toggleFaq(i)">
                <span>{{ item.q }}</span>
                <ChevronDown class="jv-ico" />
              </button>
              <div v-show="openFaq === i" class="jv-faq__a">
                <p>{{ item.a }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="jv-footer">
      <div class="jv-wrap jv-footer__inner">
        <div>
          <img src="/img/jobvarejo-logo-trim.png" alt="JobVarejo" width="160" height="48" class="jv-footer__logo">
          <p>A comunicação da sua loja, do jeito que vende.</p>
        </div>
        <div class="jv-footer__links">
          <NuxtLink to="/terms">Termos</NuxtLink>
          <NuxtLink to="/privacy">Privacidade</NuxtLink>
          <NuxtLink :to="loginHref">Entrar</NuxtLink>
          <NuxtLink :to="trialHref">15 dias grátis</NuxtLink>
        </div>
        <p class="jv-footer__copy">© {{ new Date().getFullYear() }} JobVarejo</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.jv-lp {
  --jv-blue: #0057b8;
  --jv-blue-deep: #003d82;
  --jv-orange: #ff8a00;
  --jv-orange-deep: #e56f00;
  --jv-green: #2dbe4a;
  --jv-ink: #0b1220;
  --jv-muted: #5b677a;
  --jv-paper: #f7f8fb;
  --jv-line: rgba(11, 18, 32, 0.08);
  --jv-radius: 1.25rem;
  --jv-font: 'Plus Jakarta Sans', 'Barlow', system-ui, sans-serif;
  --jv-display: 'Barlow Condensed', 'Plus Jakarta Sans', sans-serif;

  min-height: 100vh;
  background: #fff;
  color: var(--jv-ink);
  font-family: var(--jv-font);
  overflow-x: hidden;
}

.jv-wrap {
  width: min(1120px, calc(100% - 2rem));
  margin-inline: auto;
}

.jv-ico {
  width: 1.1em;
  height: 1.1em;
  flex-shrink: 0;
}

.jv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1;
  padding: 0.7rem 1.15rem;
  text-decoration: none;
  border: 1px solid transparent;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  white-space: nowrap;
}

.jv-btn:hover {
  transform: translateY(-1px);
}

.jv-btn--primary {
  background: linear-gradient(135deg, var(--jv-orange), var(--jv-orange-deep));
  color: #fff;
  box-shadow: 0 12px 28px rgba(255, 138, 0, 0.35);
}

.jv-btn--ghost {
  background: transparent;
  color: var(--jv-ink);
  border-color: var(--jv-line);
}

.jv-btn--glass {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(10px);
}

.jv-btn--xl {
  padding: 1rem 1.35rem;
  font-size: 1.02rem;
}

.jv-btn--block {
  width: 100%;
}

/* NAV */
.jv-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.jv-nav.is-scrolled {
  border-bottom-color: var(--jv-line);
  box-shadow: 0 8px 28px rgba(11, 18, 32, 0.06);
  background: rgba(255, 255, 255, 0.94);
}

.jv-nav__inner {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-height: 4.5rem;
}

.jv-brand {
  margin-right: auto;
  display: flex;
  align-items: center;
}

.jv-brand__logo {
  height: 2.85rem;
  width: auto;
  object-fit: contain;
}

.jv-nav__links {
  display: none;
  gap: 1.35rem;
}

.jv-nav__links a {
  color: var(--jv-muted);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.92rem;
}

.jv-nav__links a:hover {
  color: var(--jv-blue);
}

.jv-nav__actions {
  display: none;
  align-items: center;
  gap: 0.55rem;
}

.jv-nav__burger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 0.85rem;
  border: 1px solid var(--jv-line);
  background: #fff;
}

.jv-nav__mobile {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 0.75rem 1rem 1.2rem;
  border-top: 1px solid var(--jv-line);
  background: #fff;
}

.jv-nav__mobile a:not(.jv-btn) {
  font-weight: 600;
  color: var(--jv-ink);
  text-decoration: none;
  padding: 0.4rem 0;
}

/* HERO */
.jv-hero {
  position: relative;
  padding: 3.2rem 0 2rem;
  color: #fff;
  overflow: hidden;
}

.jv-hero__media {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.jv-hero__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.jv-hero__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(115deg, rgba(0, 40, 90, 0.9) 0%, rgba(0, 61, 130, 0.72) 48%, rgba(229, 111, 0, 0.5) 100%),
    linear-gradient(to top, rgba(11, 18, 32, 0.78), transparent 52%);
}

.jv-hero__content {
  position: relative;
  z-index: 1;
  max-width: 40rem;
  padding-bottom: 1.5rem;
}

.jv-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 1rem;
}

.jv-eyebrow--dark {
  color: var(--jv-orange);
}

.jv-hero h1 {
  font-family: var(--jv-display);
  font-weight: 800;
  font-size: clamp(2.5rem, 7.5vw, 4.4rem);
  line-height: 0.95;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  margin: 0 0 1rem;
}

.jv-grad {
  background: linear-gradient(90deg, #ffd28a, #ff8a00 55%, #ffe6c2);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.jv-hero__lead {
  font-size: clamp(1.02rem, 2.2vw, 1.18rem);
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.88);
  margin: 0 0 1.5rem;
}

.jv-hero__lead strong {
  color: #fff;
}

.jv-hero__cta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-bottom: 1.25rem;
}

.jv-hero__trust {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem 1.2rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.88);
}

.jv-hero__trust li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.jv-hero__preview {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 1rem;
  margin-top: 1.25rem;
}

.jv-preview-card {
  margin: 0;
  border-radius: var(--jv-radius);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 28px 55px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(8px);
}

.jv-preview-card img,
.jv-preview-card video {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 9 / 16;
  object-fit: cover;
  max-height: 420px;
}

.jv-preview-card figcaption {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.9rem;
  font-size: 0.88rem;
  font-weight: 600;
  background: rgba(0, 30, 70, 0.5);
}

.jv-pill {
  display: inline-flex;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: var(--jv-orange);
  color: #fff;
}

.jv-pill--blue {
  background: var(--jv-blue);
}

/* SECTIONS */
.jv-section {
  padding: 4.5rem 0;
}

.jv-section--tint {
  background:
    radial-gradient(circle at 8% 0%, rgba(0, 87, 184, 0.07), transparent 40%),
    radial-gradient(circle at 92% 20%, rgba(255, 138, 0, 0.08), transparent 35%),
    var(--jv-paper);
}

.jv-section__head {
  max-width: 38rem;
  margin-bottom: 2.2rem;
}

.jv-section__head--center {
  text-align: center;
  margin-inline: auto;
}

.jv-section__head h2,
.jv-exemplo__copy h2,
.jv-trial__card h2,
.jv-faq .jv-section__head h2 {
  font-family: var(--jv-display);
  font-size: clamp(1.9rem, 4.2vw, 2.9rem);
  line-height: 1;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  margin: 0 0 0.7rem;
  font-weight: 800;
}

/* EXEMPLO — 1 peça forte */
.jv-exemplo {
  display: grid;
  gap: 2rem;
  align-items: center;
}

.jv-exemplo__copy p {
  color: var(--jv-muted);
  line-height: 1.55;
  margin: 0 0 1.1rem;
}

.jv-exemplo__copy strong {
  color: var(--jv-ink);
}

.jv-exemplo__list {
  list-style: none;
  margin: 0 0 1.4rem;
  padding: 0;
  display: grid;
  gap: 0.45rem;
}

.jv-exemplo__list li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
}

.jv-exemplo__list .jv-ico {
  color: var(--jv-green);
}

.jv-exemplo__visual {
  border-radius: calc(var(--jv-radius) + 0.2rem);
  overflow: hidden;
  box-shadow: 0 24px 50px rgba(11, 18, 32, 0.14);
  border: 1px solid var(--jv-line);
  max-width: 360px;
  margin-inline: auto;
}

.jv-exemplo__visual img {
  display: block;
  width: 100%;
  height: auto;
}

/* MODULE CARDS */
.jv-mod-grid {
  display: grid;
  gap: 0.9rem;
}

.jv-mod-card {
  padding: 1.25rem 1.2rem;
  border-radius: var(--jv-radius);
  background: #fff;
  border: 1px solid var(--jv-line);
  box-shadow: 0 12px 28px rgba(11, 18, 32, 0.04);
}

.jv-mod-card__icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 87, 184, 0.08);
  color: var(--jv-blue);
  margin-bottom: 0.75rem;
}

.jv-mod-card h3 {
  margin: 0 0 0.35rem;
  font-size: 1.15rem;
}

.jv-mod-card p {
  margin: 0;
  color: var(--jv-muted);
  line-height: 1.45;
}

.jv-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.9rem;
}

.jv-steps li {
  padding: 1.25rem 1.2rem;
  border-radius: var(--jv-radius);
  border: 1px solid var(--jv-line);
  background: #fff;
}

.jv-steps span {
  display: inline-block;
  font-family: var(--jv-display);
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--jv-orange);
  margin-bottom: 0.4rem;
}

.jv-steps h3 {
  margin: 0 0 0.3rem;
  font-size: 1.1rem;
}

.jv-steps p {
  margin: 0;
  color: var(--jv-muted);
  line-height: 1.45;
}

/* TRIAL */
.jv-trial {
  padding: 0 0 4.5rem;
}

.jv-trial__card {
  display: grid;
  gap: 1.5rem;
  padding: clamp(1.4rem, 4vw, 2.3rem);
  border-radius: calc(var(--jv-radius) + 0.4rem);
  background: linear-gradient(135deg, rgba(0, 61, 130, 0.96), rgba(0, 87, 184, 0.9) 55%, rgba(229, 111, 0, 0.88));
  color: #fff;
  box-shadow: 0 28px 55px rgba(0, 61, 130, 0.26);
}

.jv-trial__card p:not(.jv-eyebrow):not(.jv-trial__note) {
  color: rgba(255, 255, 255, 0.88);
  margin: 0;
}

.jv-trial__note {
  margin: 0.85rem 0 0;
  text-align: center;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.92rem;
}

.jv-trial__note a {
  color: #fff;
  font-weight: 700;
}

/* FAQ */
.jv-faq__list {
  display: grid;
  gap: 0.6rem;
}

.jv-faq__item {
  border: 1px solid var(--jv-line);
  border-radius: 1rem;
  background: #fff;
  overflow: hidden;
}

.jv-faq__q {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1.1rem;
  border: 0;
  background: transparent;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  color: var(--jv-ink);
}

.jv-faq__q .jv-ico {
  color: var(--jv-muted);
  transition: transform 0.2s ease;
}

.jv-faq__item.is-open .jv-faq__q .jv-ico {
  transform: rotate(180deg);
  color: var(--jv-orange);
}

.jv-faq__a {
  padding: 0 1.1rem 1rem;
}

.jv-faq__a p {
  margin: 0;
  color: var(--jv-muted);
  line-height: 1.5;
}

/* FOOTER */
.jv-footer {
  border-top: 1px solid var(--jv-line);
  background: var(--jv-paper);
  padding: 2.2rem 0 1.8rem;
}

.jv-footer__inner {
  display: grid;
  gap: 1rem;
}

.jv-footer__logo {
  height: 2.4rem;
  width: auto;
  margin-bottom: 0.4rem;
}

.jv-footer__inner p {
  margin: 0;
  color: var(--jv-muted);
}

.jv-footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.jv-footer__links a {
  color: var(--jv-ink);
  font-weight: 600;
  text-decoration: none;
}

.jv-footer__copy {
  font-size: 0.85rem;
}

@media (min-width: 768px) {
  .jv-brand__logo {
    height: 3.15rem;
  }

  .jv-nav__links,
  .jv-nav__actions {
    display: flex;
  }

  .jv-nav__burger,
  .jv-nav__mobile {
    display: none;
  }

  .jv-hero {
    padding: 4rem 0 2.5rem;
  }

  .jv-hero__preview {
    grid-template-columns: 1fr 1fr;
    max-width: 640px;
    align-items: end;
  }

  .jv-preview-card--video {
    max-width: 280px;
    justify-self: end;
  }

  .jv-exemplo {
    grid-template-columns: 1.15fr 0.85fr;
    gap: 3rem;
  }

  .jv-exemplo__visual {
    margin-inline: 0;
    justify-self: end;
  }

  .jv-mod-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .jv-steps {
    grid-template-columns: repeat(3, 1fr);
  }

  .jv-trial__card {
    grid-template-columns: 1.4fr 0.8fr;
    align-items: center;
  }
}

@media (min-width: 1024px) {
  .jv-mod-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
