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
  Sparkles,
} from "lucide-vue-next";

definePageMeta({
  layout: false,
  ssr: true,
});

useSeoMeta({
  title: "JobVarejo — Encartes, vídeos e rádio da sua loja",
  description:
    "Monte as ofertas do seu supermercado, farmácia ou comércio em minutos. Teste grátis por 15 dias.",
  ogTitle: "JobVarejo — As ofertas da sua loja, prontas pra vender",
  ogDescription: "Feito pro seu negócio. 15 dias grátis.",
  ogImage: "/img/jobvarejo-logo.png",
  twitterCard: "summary_large_image",
});

const mobileOpen = ref(false);
const activeExample = ref(0);
const openFaq = ref<number | null>(0);
const scrolled = ref(false);

const trialHref = "/auth/register?trial=15";
const loginHref = "/auth/login";

const modules = [
  {
    icon: LayoutTemplate,
    title: "Encartes que chamam atenção",
    text: "Cola a lista, escolhe o modelo e sai o material da sua loja — WhatsApp, impressão ou TV.",
  },
  {
    icon: ImageIcon,
    title: "Sua marca em cada campanha",
    text: "Posts e campanhas com a sua logo, no formato certo pra rede e PDV.",
  },
  {
    icon: Clapperboard,
    title: "Ofertas que ganham movimento",
    text: "Reels, Stories e TV em até 30s — do mesmo jeito que você vê no sistema.",
  },
  {
    icon: Radio,
    title: "Sua loja também tem voz",
    text: "Jingles e offs no corredor, com agenda automática.",
  },
];

const featureBenefits = [
  [
    "Organize produtos e preços a partir da sua lista",
    "Personalize modelos com logo e contatos",
    "Exporte em PNG, PDF e ZIP",
  ],
  [
    "Crie posts e campanhas para o seu negócio",
    "Edite textos, imagens e elementos da arte",
    "Prepare materiais para redes sociais e ponto de venda",
  ],
  [
    "Transforme ofertas em conteúdo com movimento",
    "Crie em formatos para Reels, Stories e TV",
    "Mantenha a identidade da sua loja nos vídeos",
  ],
  [
    "Reúna músicas, jingles e anúncios da loja",
    "Organize a programação do ambiente",
    "Leve sua comunicação também aos corredores",
  ],
];

const steps = [
  {
    n: "01",
    title: "Coloca a cara da sua loja",
    text: "Logo e contatos. Tudo já sai com a sua marca.",
  },
  {
    n: "02",
    title: "Manda a lista de ofertas",
    text: "Do Excel ou do WhatsApp. A IA organiza produto e preço.",
  },
  {
    n: "03",
    title: "Publica e vende",
    text: "Encarte, arte, vídeo e rádio nos canais da sua loja.",
  },
];

const faqs = [
  {
    q: "Os 15 dias grátis incluem o quê?",
    a: "Você usa de verdade: encartes, artes, vídeos e rádio indoor. Sem cartão pra começar.",
  },
  {
    q: "Preciso saber fazer arte?",
    a: "Não. Escolhe o modelo, coloca preço e logo. Se quiser mexer mais, tem editor completo.",
  },
  {
    q: "Serve pra minha loja?",
    a: "Supermercado, farmácia, hortifruti, açougue, padaria, pet, atacarejo — se tem oferta pra divulgar, serve.",
  },
  {
    q: "Consigo mandar no WhatsApp e imprimir?",
    a: "Sim. PNG, PDF e ZIP. Vídeo pra Reels/Stories e pra TV da loja.",
  },
];

const onScroll = () => {
  scrolled.value = window.scrollY > 24;
};

onMounted(() => {
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
});

const toggleFaq = (index: number) => {
  openFaq.value = openFaq.value === index ? null : index;
};

const closeMobile = () => {
  mobileOpen.value = false;
};
</script>

<template>
  <div class="jv-lp">
    <a href="#conteudo" class="skip-link">Pular para o conteúdo</a>
    <header
      class="jv-nav"
      :class="{ 'is-scrolled': scrolled }"
      @keydown.esc="closeMobile"
    >
      <div class="jv-wrap nav-inner">
        <a
          href="#topo"
          class="brand"
          aria-label="JobVarejo, início"
          @click="closeMobile"
          ><img
            src="/img/jobvarejo-logo-trim.png"
            alt="JobVarejo"
            width="176"
            height="56"
        /></a>
        <nav class="nav-links" aria-label="Principal">
          <a href="#modulos">Soluções</a
          ><a href="#exemplo">Explore as funções</a
          ><a href="#como">Como funciona</a>
        </nav>
        <div class="nav-actions">
          <NuxtLink :to="loginHref" class="login-link">Entrar</NuxtLink
          ><NuxtLink :to="trialHref" class="btn btn-primary btn-small"
            >Começar grátis <ArrowRight :size="16"
          /></NuxtLink>
        </div>
        <button
          class="menu-toggle"
          type="button"
          :aria-expanded="mobileOpen"
          aria-controls="mobile-nav"
          :aria-label="mobileOpen ? 'Fechar menu' : 'Abrir menu'"
          @click="mobileOpen = !mobileOpen"
        >
          <X v-if="mobileOpen" /><Menu v-else />
        </button>
      </div>
      <nav
        v-if="mobileOpen"
        id="mobile-nav"
        class="mobile-nav"
        aria-label="Menu móvel"
      >
        <a href="#modulos" @click="closeMobile">Soluções</a
        ><a href="#exemplo" @click="closeMobile">Explore as funções</a
        ><a href="#como" @click="closeMobile">Como funciona</a
        ><a href="#faq" @click="closeMobile">Dúvidas</a
        ><NuxtLink :to="loginHref" @click="closeMobile"
          >Entrar na minha conta</NuxtLink
        ><NuxtLink :to="trialHref" class="btn btn-primary" @click="closeMobile"
          >Começar grátis</NuxtLink
        >
      </nav>
    </header>

    <main id="conteudo">
      <section id="topo" class="hero">
        <div class="jv-wrap hero-grid">
          <div class="hero-copy">
            <div class="hero-label">
              <span /> O estúdio de criação do seu varejo
            </div>
            <h1>Toda a comunicação<br />da sua loja.<br />Em um só lugar.</h1>
            <p class="hero-lead">
              Crie encartes, prepare campanhas, transforme ofertas em vídeos e
              organize a rádio da sua loja. Experimente todas essas
              possibilidades no JobVarejo.
            </p>
            <div class="hero-actions">
              <NuxtLink :to="trialHref" class="btn btn-primary"
                >Testar grátis por 15 dias <ArrowRight :size="18" /></NuxtLink
              ><a href="#exemplo" class="demo-link"
                ><span><Play :size="14" fill="currentColor" /></span> Conhecer
                as funções</a
              >
            </div>
            <div class="hero-assurance">
              <span><Check :size="15" /> Sem cartão de crédito</span
              ><span><Check :size="15" /> Sem precisar ser designer</span>
            </div>
          </div>
          <div
            class="hero-stage"
            aria-label="Visão ilustrativa das funções disponíveis no JobVarejo"
          >
            <div class="workspace-preview">
              <div class="workspace-top">
                <span class="workspace-symbol"
                  ><LayoutTemplate :size="18" /></span
                ><strong>Seu espaço de criação</strong
                ><span class="preview-label">Visão ilustrativa</span>
              </div>
              <div class="workspace-body">
                <div class="workspace-welcome">
                  <span>Da ideia à divulgação</span>
                  <h2>O que vamos criar hoje?</h2>
                  <p>Uma plataforma. Toda a sua comunicação.</p>
                </div>
                <div class="workspace-tools">
                  <a
                    v-for="(mod, i) in modules"
                    :key="mod.title"
                    href="#exemplo"
                    class="workspace-tool"
                    @click="activeExample = i"
                    ><span class="module-icon" :class="`module-icon-${i}`"
                      ><component :is="mod.icon" :size="23" /></span
                    ><strong>{{
                      [
                        "Encartes",
                        "Estúdio de artes",
                        "Vídeos",
                        "Rádio indoor",
                      ][i]
                    }}</strong
                    ><span>{{
                      [
                        "Produtos e preços em destaque",
                        "Campanhas com a sua identidade",
                        "Ofertas em movimento",
                        "Música e anúncios na loja",
                      ][i]
                    }}</span
                    ><ArrowRight :size="16" class="tool-arrow"
                  /></a>
                </div>
                <div class="workspace-bottom">
                  <Sparkles :size="17" /><span
                    >Sua marca acompanha cada criação.</span
                  ><Check :size="16" />
                </div>
              </div>
            </div>
            <div class="trial-float">
              <span class="trial-float-number">15</span>
              <div>
                <strong>Dias para experimentar</strong
                ><span>Comece sem cartão de crédito</span>
              </div>
              <Check :size="20" />
            </div>
          </div>
        </div>
        <div class="jv-wrap sectors">
          <p>Feito para quem movimenta o varejo</p>
          <div>
            <span>Supermercados</span><span>Hortifrutis</span
            ><span>Farmácias</span><span>Açougues</span><span>Atacarejos</span>
          </div>
        </div>
      </section>

      <section id="modulos" class="section solutions">
        <div class="jv-wrap">
          <div class="section-heading">
            <h2>
              Uma loja inteira de possibilidades.<br />Um só lugar para criar.
            </h2>
            <p>
              Da primeira oferta ao som do corredor, sua comunicação fica com a
              mesma identidade.
            </p>
          </div>
          <div class="module-grid">
            <article
              v-for="(mod, i) in modules"
              :key="mod.title"
              class="module"
            >
              <span class="module-icon" :class="`module-icon-${i}`"
                ><component :is="mod.icon" :size="24" :stroke-width="1.6"
              /></span>
              <h3>{{ mod.title }}</h3>
              <p>{{ mod.text }}</p>
              <a href="#exemplo" v-if="i < 3" @click="activeExample = i"
                >Conheça a função <ArrowRight :size="16" /></a
              ><a href="#como" v-else
                >Veja como começar <ArrowRight :size="16"
              /></a>
            </article>
          </div>
        </div>
      </section>

      <section id="exemplo" class="section showcase">
        <div class="jv-wrap">
          <div class="section-heading">
            <div>
              <span class="section-label"
                >Conheça seu próximo espaço de trabalho</span
              >
              <h2>Da oferta da semana<br />à experiência dentro da loja.</h2>
            </div>
            <p>
              Explore o que você pode fazer. Depois, teste com os produtos e a
              identidade do seu negócio.
            </p>
          </div>
          <div class="feature-explorer">
            <div
              class="feature-menu"
              role="group"
              aria-label="Explorar funções"
            >
              <button
                v-for="(mod, i) in modules"
                :key="mod.title"
                type="button"
                :aria-pressed="activeExample === i"
                :class="{ active: activeExample === i }"
                @click="activeExample = i"
              >
                <component :is="mod.icon" :size="22" /><span>{{
                  [
                    "Encartes",
                    "Estúdio de artes",
                    "Vídeos de ofertas",
                    "Rádio indoor",
                  ][i]
                }}</span
                ><ArrowRight :size="17" />
              </button>
            </div>
            <div class="feature-detail" aria-live="polite">
              <span class="module-icon" :class="`module-icon-${activeExample}`"
                ><component :is="modules[activeExample]?.icon" :size="27"
              /></span>
              <h3>{{ modules[activeExample]?.title }}</h3>
              <p>{{ modules[activeExample]?.text }}</p>
              <ul class="feature-list">
                <li
                  v-for="benefit in featureBenefits[activeExample]"
                  :key="benefit"
                >
                  <Check :size="18" />{{ benefit }}
                </li>
              </ul>
              <NuxtLink :to="trialHref" class="btn btn-primary"
                >Experimentar grátis por 15 dias <ArrowRight :size="18"
              /></NuxtLink>
              <p class="feature-note">
                Crie sua conta e conheça as ferramentas.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="como" class="section how">
        <div class="jv-wrap">
          <div class="section-heading">
            <h2>Menos trabalho na criação.<br />Mais tempo para a sua loja.</h2>
            <p>
              Você conhece seu negócio.<br />O JobVarejo ajuda a mostrar o
              melhor dele.
            </p>
          </div>
          <ol class="steps">
            <li v-for="step in steps" :key="step.n">
              <span class="step-number">{{ step.n }}</span>
              <h3>{{ step.title }}</h3>
              <p>{{ step.text }}</p>
            </li>
          </ol>
        </div>
      </section>

      <section class="trial">
        <div class="jv-wrap">
          <div class="trial-panel">
            <div class="trial-copy">
              <span class="trial-label"
                ><Sparkles :size="17" /> Sua próxima campanha começa aqui</span
              >
              <h2>Sua loja tem muito<br />para mostrar.<br />Comece hoje.</h2>
              <p>
                Experimente o JobVarejo por 15 dias e dê uma nova cara às suas
                ofertas.
              </p>
              <NuxtLink :to="trialHref" class="btn btn-white"
                >Começar meu teste grátis <ArrowRight :size="18" /></NuxtLink
              ><span class="trial-note"
                >Sem cartão de crédito para começar.</span
              >
            </div>
            <div
              class="trial-art"
              aria-label="Encartes, artes, vídeos e rádio incluídos na plataforma"
            >
              <div class="trial-suite">
                <span>Seu próximo passo</span
                ><strong>Uma conta.<br />Todas as possibilidades.</strong>
                <div v-for="(mod, i) in modules" :key="mod.title">
                  <component :is="mod.icon" :size="21" /><span>{{
                    [
                      "Encartes de ofertas",
                      "Estúdio de artes",
                      "Vídeos para redes e TV",
                      "Rádio indoor",
                    ][i]
                  }}</span
                  ><Check :size="17" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" class="section">
        <div class="jv-wrap faq-grid">
          <div>
            <span class="section-label">Tudo claro, desde o começo</span>
            <h2>Ainda tem <br />alguma dúvida?</h2>
            <p class="faq-intro">O essencial para dar o primeiro passo.</p>
          </div>
          <div class="faq-list">
            <div
              v-for="(item, i) in faqs"
              :key="item.q"
              class="faq-item"
              :class="{ 'is-open': openFaq === i }"
            >
              <h3>
                <button
                  :id="`faq-question-${i}`"
                  type="button"
                  :aria-expanded="openFaq === i"
                  :aria-controls="`faq-answer-${i}`"
                  @click="toggleFaq(i)"
                >
                  <span>{{ item.q }}</span
                  ><ChevronDown :size="20" />
                </button>
              </h3>
              <div
                v-show="openFaq === i"
                :id="`faq-answer-${i}`"
                role="region"
                :aria-labelledby="`faq-question-${i}`"
                class="faq-answer"
              >
                <p>{{ item.a }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
    <footer class="footer">
      <div class="jv-wrap">
        <div class="footer-main">
          <div>
            <img
              src="/img/jobvarejo-logo-trim.png"
              alt="JobVarejo"
              width="160"
              height="51"
            />
            <p>Seu varejo merece ser visto.</p>
          </div>
          <nav aria-label="Rodapé">
            <a href="#modulos">Soluções</a><a href="#faq">Dúvidas</a
            ><NuxtLink :to="loginHref">Entrar na conta</NuxtLink>
          </nav>
          <NuxtLink :to="trialHref" class="footer-cta"
            >Comece seus 15 dias grátis <ArrowRight :size="18"
          /></NuxtLink>
        </div>
        <div class="footer-bottom">
          <p>© {{ new Date().getFullYear() }} JobVarejo</p>
          <div>
            <NuxtLink to="/terms">Termos de uso</NuxtLink
            ><NuxtLink to="/privacy">Privacidade</NuxtLink>
          </div>
          <span>Criado para o ritmo do varejo.</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.jv-lp {
  --ink: #172f50;
  --muted: #5d6e83;
  --blue: #145dcc;
  --line: #dfe6ef;
  --paper: #f4f7fc;
  background: #fff;
  color: var(--ink);
  font-family: "Plus Jakarta Sans", "Barlow", sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow: clip;
}
.jv-lp * {
  box-sizing: border-box;
}
.jv-wrap {
  width: min(1240px, calc(100% - 96px));
  margin-inline: auto;
}
.jv-lp a {
  text-decoration: none;
}
.jv-lp button,
.jv-lp a {
  -webkit-tap-highlight-color: transparent;
}
.jv-lp button {
  cursor: pointer;
}
.jv-lp :is(a, button):focus-visible {
  outline: 3px solid #ed853c;
  outline-offset: 5px;
}
.jv-lp :is(h1, h2, h3, p, figure) {
  margin: 0;
}
.jv-lp :is(ul, ol) {
  list-style: none;
  margin: 0;
  padding: 0;
}
.jv-lp section {
  scroll-margin-top: 100px;
}
.skip-link {
  position: fixed;
  top: -80px;
  left: 20px;
  z-index: 100;
  background: white;
  padding: 14px;
  color: var(--blue);
}
.skip-link:focus {
  top: 12px;
}
.jv-nav {
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}
.jv-nav.is-scrolled {
  border-color: var(--line);
}
.nav-inner {
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
}
.brand img {
  width: 163px;
  height: auto;
  display: block;
}
.nav-links,
.nav-actions {
  display: flex;
  align-items: center;
  gap: 29px;
}
.nav-links a,
.login-link {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
}
.nav-links a:hover,
.login-link:hover {
  color: var(--blue);
}
.btn {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 13px;
  min-height: 54px;
  padding: 15px 23px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 700;
  transition:
    background 0.18s,
    transform 0.18s;
  line-height: 1.5;
}
.btn:hover {
  transform: translateY(-2px);
}
.btn-primary {
  background: var(--blue);
  color: white;
  box-shadow: 0 5px 12px #145dcc16;
}
.btn-primary:hover {
  background: #104eae;
}
.btn-small {
  min-height: 43px;
  padding: 11px 17px;
  font-size: 12px;
}
.menu-toggle {
  display: none;
  background: none;
  border: 0;
  color: var(--ink);
}
.mobile-nav {
  display: grid;
  gap: 20px;
  padding: 20px 28px 28px;
  border-bottom: 1px solid var(--line);
  background: white;
}
.mobile-nav a {
  color: var(--ink);
  font-size: 14px;
}
.mobile-nav .btn {
  color: white;
}
.hero {
  background: linear-gradient(115deg, #fff 30%, #f0f5fd 100%);
}
.hero-grid {
  display: grid;
  grid-template-columns: 1fr 1.08fr;
  gap: 38px;
  align-items: center;
  min-height: 690px;
  padding-top: 32px;
  padding-bottom: 44px;
}
.hero-label {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  color: #4e6380;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 27px;
}
.hero-label > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ed853c;
}
.hero h1 {
  font-size: clamp(48px, 4.65vw, 70px);
  font-weight: 700;
  letter-spacing: -0.065em;
  line-height: 1.075;
}
.hero-lead {
  font-size: 15px;
  line-height: 1.9;
  max-width: 430px;
  color: var(--muted);
  margin-top: 25px !important;
}
.hero-actions {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-top: 31px;
}
.demo-link {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
}
.demo-link > span {
  width: 31px;
  height: 31px;
  border: 1px solid #cbd7e7;
  border-radius: 50%;
  display: grid;
  place-items: center;
}
.hero-assurance {
  display: flex;
  gap: 20px;
  margin-top: 21px;
  color: #61718a;
  font-size: 10px;
}
.hero-assurance span {
  display: flex;
  gap: 6px;
  align-items: center;
}
.hero-assurance svg {
  color: #37806b;
}
.hero-stage {
  height: 584px;
  position: relative;
  isolation: isolate;
}
.sectors {
  padding-top: 27px;
  padding-bottom: 34px;
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.sectors p {
  font-size: 11px;
  color: #6d7b8f;
  max-width: 150px;
  line-height: 1.7;
}
.sectors > div {
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
}
.sectors span {
  font-family: Barlow, sans-serif;
  font-size: 19px;
  font-weight: 600;
  color: #6b7d93;
}
.section {
  padding: 105px 0;
}
.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 45px;
  margin-bottom: 49px;
}
.jv-lp h2 {
  font-size: clamp(30px, 3vw, 43px);
  font-weight: 600;
  letter-spacing: -0.05em;
  line-height: 1.2;
}
.section-heading > p {
  max-width: 300px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.9;
}
.module-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 30px;
}
.module {
  padding: 0 24px 0 0;
  border-right: 1px solid var(--line);
}
.module:last-child {
  border: 0;
  padding-right: 0;
}
.module-icon {
  display: grid;
  place-items: center;
  width: 49px;
  height: 49px;
  border-radius: 14px;
  margin-bottom: 25px;
  color: #2160b4;
  background: #eaf2ff;
}
.module-icon-1 {
  background: #fff0e8;
  color: #bc5d29;
}
.module-icon-2 {
  background: #eff0fb;
  color: #6360a6;
}
.module-icon-3 {
  background: #e9f4ee;
  color: #3e8062;
}
.module h3 {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.5;
  max-width: 210px;
}
.module p {
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.9;
  color: var(--muted);
}
.module a {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
  font-size: 11px;
  font-weight: 600;
  color: var(--blue);
}
.showcase {
  background: #eff4fa;
}
.section-label {
  display: block;
  font-size: 12px;
  color: var(--blue);
  font-weight: 600;
  margin-bottom: 20px;
}
.feature-list {
  display: grid;
  gap: 15px;
  margin: 28px 0 32px !important;
  font-size: 12px;
}
.feature-list li {
  display: flex;
  align-items: center;
  gap: 11px;
}
.feature-list svg {
  color: #37806b;
}
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 65px;
  margin-top: 58px !important;
}
.step-number {
  display: block;
  font-family: Barlow, sans-serif;
  font-size: 42px;
  color: #a7bad2;
  font-weight: 400;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 24px;
}
.steps h3 {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.025em;
}
.steps p {
  font-size: 13px;
  line-height: 1.9;
  color: var(--muted);
  margin-top: 12px;
  max-width: 280px;
}
.trial {
  padding: 0 0 20px;
}
.trial-panel {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  background: #173d70;
  border-radius: 23px;
  color: white;
  overflow: hidden;
  position: relative;
}
.trial-copy {
  padding: 62px;
  z-index: 2;
}
.trial-label {
  display: flex;
  gap: 9px;
  align-items: center;
  font-size: 10px;
  color: #c2d5ef;
  margin-bottom: 23px;
}
.trial-copy h2 {
  font-size: 42px;
}
.trial-copy > p {
  font-size: 13px;
  line-height: 1.9;
  color: #c2d5ef;
  max-width: 355px;
  margin-top: 21px;
}
.btn-white {
  background: white;
  color: #173d70;
  margin-top: 27px;
}
.btn-white:hover {
  background: #e9f1fc;
}
.trial-note {
  display: block;
  font-size: 10px;
  color: #c2d5ef;
  margin-top: 16px;
}
.trial-art {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 50px 55px 50px 0;
}
.trial-art img {
  width: 285px;
  height: auto;
  max-height: 390px;
  object-fit: cover;
  transform: rotate(9deg);
  border: 6px solid white;
  border-radius: 10px;
  box-shadow: 0 15px 35px #071d454d;
  z-index: 1;
}
.faq-grid {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 90px;
}
.faq-intro {
  margin-top: 20px !important;
  font-size: 13px;
  color: var(--muted);
}
.faq-item {
  border-bottom: 1px solid var(--line);
}
.faq-item:first-child {
  border-top: 1px solid var(--line);
}
.faq-item button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 25px;
  width: 100%;
  background: none;
  border: 0;
  text-align: left;
  padding: 24px 0;
  font:
    600 14px "Plus Jakarta Sans",
    sans-serif;
  color: var(--ink);
}
.faq-item svg {
  flex-shrink: 0;
  transition: transform 0.2s;
  color: #7b8da5;
}
.faq-item.is-open svg {
  transform: rotate(180deg);
  color: var(--blue);
}
.faq-answer {
  padding: 0 28px 25px 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.9;
}
.footer {
  background: #f6f8fb;
  padding: 45px 0 22px;
  border-top: 1px solid var(--line);
}
.footer-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  padding-bottom: 34px;
}
.footer-main img {
  width: 150px;
  height: auto;
}
.footer-main p {
  font-size: 11px;
  color: var(--muted);
  margin-top: 13px;
}
.footer-main nav {
  display: flex;
  gap: 25px;
}
.footer-main nav a {
  color: var(--muted);
  font-size: 11px;
}
.footer-cta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--blue);
  font-size: 11px;
  font-weight: 600;
}
.footer-bottom {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding-top: 22px;
  border-top: 1px solid var(--line);
  font-size: 10px;
  color: #718198;
}
.footer-bottom > div {
  display: flex;
  gap: 25px;
}
.footer-bottom a {
  color: inherit;
}
@media (min-width: 1450px) {
  .hero-grid {
    min-height: 740px;
  }
  .hero-stage {
    transform: scale(1.04);
  }
}
@media (max-width: 1100px) {
  .jv-wrap {
    width: calc(100% - 64px);
  }
  .nav-links {
    gap: 19px;
  }
  .nav-actions {
    gap: 20px;
  }
  .hero-grid {
    gap: 20px;
  }
  .hero h1 {
    font-size: 55px;
  }
  .hero-actions {
    gap: 14px;
    flex-wrap: wrap;
  }
  .hero-stage {
    height: 540px;
  }
  .sectors > div {
    gap: 25px;
  }
  .trial-copy {
    padding: 45px;
  }
  .trial-copy h2 {
    font-size: 36px;
  }
  .trial-art img {
    width: 240px;
  }
  .faq-grid {
    gap: 55px;
  }
}
@media (max-width: 850px) {
  .nav-links {
    display: none;
  }
  .nav-actions {
    margin-left: auto;
  }
  .menu-toggle {
    display: block;
  }
  .nav-inner {
    height: 76px;
    gap: 20px;
  }
  .hero-grid {
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    min-height: 610px;
  }
  .hero h1 {
    font-size: 44px;
  }
  .hero-lead {
    font-size: 13px;
  }
  .hero-assurance {
    flex-direction: column;
    gap: 9px;
  }
  .hero-stage {
    height: 475px;
  }
  .sectors {
    display: block;
    text-align: center;
  }
  .sectors p {
    max-width: none;
    margin-bottom: 20px;
  }
  .sectors > div {
    justify-content: center;
    gap: 25px;
  }
  .sectors span {
    font-size: 17px;
  }
  .section {
    padding: 75px 0;
  }
  .section-heading {
    align-items: flex-start;
    gap: 30px;
  }
  .section-heading > p {
    max-width: 240px;
    font-size: 12px;
  }
  .module-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 36px;
  }
  .module:nth-child(2) {
    border: 0;
  }
  .module h3 {
    max-width: none;
  }
  .steps {
    gap: 30px;
  }
  .trial-copy {
    padding: 35px;
  }
  .trial-copy h2 {
    font-size: 30px;
  }
  .trial-art {
    padding-right: 20px;
  }
  .trial-art img {
    width: 200px;
  }
  .faq-grid {
    gap: 35px;
  }
  .footer-main {
    flex-wrap: wrap;
  }
  .footer-cta {
    width: 100%;
  }
}
@media (max-width: 600px) {
  .jv-wrap {
    width: calc(100% - 40px);
  }
  .nav-inner {
    height: 72px;
    gap: 14px;
  }
  .brand img {
    width: 135px;
  }
  .nav-actions .login-link {
    display: none;
  }
  .nav-actions .btn {
    font-size: 10px;
    min-height: 38px;
    padding: 9px 12px;
  }
  .nav-actions .btn svg {
    display: none;
  }
  .menu-toggle {
    padding: 5px;
  }
  .hero-grid {
    grid-template-columns: 1fr;
    padding-top: 35px;
    padding-bottom: 28px;
    gap: 34px;
  }
  .hero-label {
    font-size: 10px;
    margin-bottom: 21px;
  }
  .hero h1 {
    font-size: clamp(45px, 11.9vw, 65px);
    letter-spacing: -0.055em;
  }
  .hero-lead {
    font-size: 14px;
    max-width: 400px;
    margin-top: 22px !important;
  }
  .hero-actions {
    gap: 18px;
    margin-top: 24px;
  }
  .hero-actions .btn {
    padding: 14px 17px;
    font-size: 12px;
  }
  .demo-link {
    font-size: 11px;
  }
  .hero-assurance {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 9px;
    margin-top: 17px;
  }
  .hero-stage {
    height: 475px;
    width: min(390px, 100%);
    margin: auto;
  }
  .sectors {
    padding-top: 22px;
    padding-bottom: 26px;
  }
  .sectors > div {
    gap: 13px 24px;
  }
  .sectors span {
    font-size: 16px;
  }
  .sectors p {
    font-size: 10px;
    margin-bottom: 16px;
  }
  .section {
    padding: 59px 0;
  }
  .section-heading {
    display: block;
    margin-bottom: 34px;
  }
  .jv-lp h2 {
    font-size: 31px;
  }
  .section-heading > p {
    margin-top: 19px;
    max-width: 340px;
    font-size: 13px;
  }
  .module-grid {
    gap: 31px 22px;
  }
  .module {
    padding-right: 14px;
  }
  .module-icon {
    width: 43px;
    height: 43px;
    border-radius: 12px;
    margin-bottom: 18px;
  }
  .module h3 {
    font-size: 15px;
  }
  .module p {
    font-size: 11px;
    line-height: 1.8;
  }
  .module a {
    font-size: 10px;
    gap: 5px;
  }
  .module a svg {
    width: 12px;
  }
  .steps {
    grid-template-columns: 1fr;
    gap: 27px;
    margin-top: 30px !important;
  }
  .steps li {
    display: grid;
    grid-template-columns: 46px 1fr;
    gap: 6px 20px;
  }
  .step-number {
    grid-row: span 2;
    border: 0;
    padding: 0;
    margin: 0;
    font-size: 30px;
  }
  .steps h3 {
    font-size: 16px;
  }
  .steps p {
    margin: 0;
    max-width: none;
    font-size: 12px;
  }
  .trial {
    padding: 0;
  }
  .trial-panel {
    grid-template-columns: 1fr;
    border-radius: 18px;
  }
  .trial-copy {
    padding: 32px 26px 0;
  }
  .trial-copy h2 {
    font-size: 32px;
  }
  .trial-copy > p {
    font-size: 12px;
  }
  .trial-art {
    height: 300px;
    padding: 25px 0;
    justify-content: flex-end;
    padding-right: 40px;
  }
  .trial-art img {
    width: 174px;
    max-height: 245px;
  }
  .faq-grid {
    grid-template-columns: 1fr;
    gap: 29px;
  }
  .faq-grid h2 br {
    display: none;
  }
  .section-label {
    font-size: 11px;
    margin-bottom: 16px;
  }
  .faq-item button {
    font-size: 12px;
    padding: 22px 0;
  }
  .faq-answer {
    font-size: 12px;
  }
  .footer-main {
    align-items: flex-start;
    gap: 27px;
  }
  .footer-main nav {
    flex-direction: column;
    gap: 14px;
  }
  .footer-main img {
    width: 132px;
  }
  .footer-main p {
    font-size: 10px;
  }
  .footer-bottom {
    flex-wrap: wrap;
    font-size: 9px;
  }
  .footer-bottom > span {
    width: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .jv-lp * {
    transition: none !important;
    scroll-behavior: auto !important;
  }
  .btn:hover {
    transform: none;
  }
}

/* A vitrine apresenta ferramentas, sem marcas de terceiros. */
.hero h1 {
  font-size: clamp(43px, 4.3vw, 63px);
}
.hero-stage {
  height: auto;
  padding: 28px 0 48px 10px;
}
.workspace-preview {
  background: white;
  border: 1px solid #dbe5f2;
  border-radius: 18px;
  box-shadow: 0 30px 65px -30px #254b794a;
  transform: perspective(1400px) rotateY(-5deg) rotateZ(1deg);
  overflow: hidden;
}
.workspace-top {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 19px 22px;
  border-bottom: 1px solid #e6edf6;
  font-size: 11px;
}
.workspace-symbol {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  border-radius: 8px;
  background: #edf4ff;
  color: var(--blue);
}
.preview-label {
  margin-left: auto;
  font-size: 8px;
  color: #687c95;
  background: #f1f5fa;
  padding: 5px 8px;
  border-radius: 5px;
}
.workspace-body {
  padding: 28px;
  background: #fbfcff;
}
.workspace-welcome > span {
  font-size: 9px;
  color: #73859c;
}
.workspace-welcome h2 {
  font-size: 24px;
  margin-top: 8px;
}
.workspace-welcome p {
  font-size: 10px;
  color: var(--muted);
  margin-top: 9px;
}
.workspace-tools {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 13px;
  margin-top: 24px;
}
.workspace-tool {
  background: white;
  border: 1px solid #e2e9f2;
  border-radius: 11px;
  padding: 18px;
  position: relative;
  transition:
    border-color 0.2s,
    transform 0.2s;
  color: var(--ink);
}
.workspace-tool:hover {
  border-color: #759dd7;
  transform: translateY(-3px);
}
.workspace-tool .module-icon {
  width: 39px;
  height: 39px;
  border-radius: 11px;
  margin-bottom: 18px;
}
.workspace-tool strong {
  display: block;
  font-size: 12px;
}
.workspace-tool > span:not(.module-icon) {
  display: block;
  font-size: 9px;
  line-height: 1.7;
  margin-top: 7px;
  color: var(--muted);
  max-width: 140px;
}
.tool-arrow {
  position: absolute;
  top: 23px;
  right: 16px;
  color: #9aaec8;
}
.workspace-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid #e4ebf4;
  margin-top: 22px;
  padding-top: 18px;
  font-size: 9px;
  color: #627a98;
}
.workspace-bottom svg:first-child {
  color: var(--blue);
}
.workspace-bottom svg:last-child {
  margin-left: auto;
  color: #37806b;
}
.trial-float {
  position: absolute;
  bottom: 18px;
  right: -8px;
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff;
  border: 1px solid #dfe7f1;
  padding: 14px 20px;
  border-radius: 12px;
  box-shadow: 0 12px 30px #1d3d6521;
}
.trial-float-number {
  font:
    600 37px Barlow,
    sans-serif;
  color: var(--blue);
  line-height: 1;
}
.trial-float strong {
  display: block;
  font-size: 11px;
}
.trial-float div span {
  display: block;
  font-size: 9px;
  margin-top: 5px;
  color: var(--muted);
}
.trial-float > svg {
  color: #37806b;
  margin-left: 9px;
}
.feature-explorer {
  display: grid;
  grid-template-columns: 1fr 1.65fr;
  background: white;
  border: 1px solid #dce5f0;
  border-radius: 17px;
  overflow: hidden;
}
.feature-menu {
  padding: 23px;
  background: #e7eef8;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.feature-menu button {
  display: flex;
  align-items: center;
  gap: 13px;
  border: 1px solid transparent;
  background: transparent;
  padding: 21px 18px;
  border-radius: 9px;
  font:
    600 13px "Plus Jakarta Sans",
    sans-serif;
  color: #60758f;
  text-align: left;
}
.feature-menu button.active {
  background: white;
  color: var(--blue);
  border-color: #dfe6f1;
  box-shadow: 0 4px 8px #19334e06;
}
.feature-menu button svg:last-child {
  margin-left: auto;
}
.feature-detail {
  padding: 43px 49px;
  min-height: 425px;
}
.feature-detail > .module-icon {
  margin-bottom: 21px;
}
.feature-detail h3 {
  font-size: 26px;
  letter-spacing: -0.04em;
  font-weight: 600;
}
.feature-detail > p {
  font-size: 13px;
  line-height: 1.9;
  color: var(--muted);
  margin-top: 13px;
  max-width: 460px;
}
.feature-detail .feature-note {
  font-size: 10px;
  margin-top: 13px;
}
.trial-art {
  padding: 45px;
}
.trial-suite {
  width: 100%;
  border: 1px solid #ffffff29;
  background: #ffffff09;
  border-radius: 17px;
  padding: 30px;
}
.trial-suite > span {
  font-size: 10px;
  color: #c2d5ef;
}
.trial-suite > strong {
  display: block;
  font-size: 27px;
  letter-spacing: -0.04em;
  line-height: 1.3;
  margin: 15px 0 25px;
}
.trial-suite > div {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 15px 0;
  border-top: 1px solid #ffffff20;
  font-size: 12px;
  color: #e1ebf9;
}
.trial-suite > div svg:last-child {
  margin-left: auto;
  color: #a9d5ca;
}
@media (max-width: 1100px) {
  .workspace-body {
    padding: 22px;
  }
  .workspace-welcome h2 {
    font-size: 22px;
  }
  .workspace-tool {
    padding: 15px;
  }
  .trial-art {
    padding: 30px;
  }
  .trial-suite {
    padding: 24px;
  }
}
@media (max-width: 850px) {
  .hero-grid {
    grid-template-columns: 1fr;
    gap: 20px;
    padding-top: 45px;
  }
  .hero-copy {
    max-width: 610px;
  }
  .hero h1 {
    font-size: 59px;
  }
  .hero-lead {
    font-size: 15px;
    max-width: 510px;
  }
  .hero-assurance {
    flex-direction: row;
  }
  .hero-stage {
    width: min(540px, 100%);
    margin: auto;
    padding-top: 15px;
  }
  .workspace-welcome h2 {
    font-size: 25px;
  }
  .workspace-tool {
    padding: 20px;
  }
  .feature-explorer {
    grid-template-columns: 1fr 1.45fr;
  }
  .feature-menu {
    padding: 15px;
  }
  .feature-menu button {
    padding: 20px 12px;
    font-size: 11px;
    gap: 9px;
  }
  .feature-detail {
    padding: 30px;
  }
  .trial-art {
    padding: 25px;
  }
  .trial-suite > strong {
    font-size: 24px;
  }
  .trial-suite > div {
    font-size: 10px;
  }
}
@media (max-width: 600px) {
  .hero-grid {
    padding-top: 30px;
  }
  .hero h1 {
    font-size: clamp(39px, 10.2vw, 57px);
  }
  .hero-stage {
    padding: 10px 0 49px;
  }
  .workspace-preview {
    transform: none;
    border-radius: 14px;
  }
  .workspace-top {
    padding: 13px;
    gap: 7px;
    font-size: 9px;
  }
  .preview-label {
    font-size: 7px;
  }
  .workspace-body {
    padding: 20px 15px;
  }
  .workspace-welcome h2 {
    font-size: 23px;
  }
  .workspace-tools {
    gap: 10px;
    margin-top: 20px;
  }
  .workspace-tool {
    padding: 15px 12px;
  }
  .workspace-tool strong {
    font-size: 11px;
  }
  .workspace-tool > span:not(.module-icon) {
    font-size: 8px;
  }
  .tool-arrow {
    right: 12px;
    top: 20px;
    width: 13px;
  }
  .workspace-tool .module-icon {
    width: 35px;
    height: 35px;
    margin-bottom: 15px;
  }
  .workspace-bottom {
    font-size: 8px;
  }
  .trial-float {
    right: 9px;
    bottom: 15px;
    padding: 12px 16px;
  }
  .trial-float-number {
    font-size: 31px;
  }
  .trial-float strong {
    font-size: 10px;
  }
  .feature-explorer {
    grid-template-columns: 1fr;
  }
  .feature-menu {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 13px;
  }
  .feature-menu button {
    padding: 13px 9px;
    font-size: 10px;
    gap: 7px;
  }
  .feature-menu button svg {
    width: 17px;
  }
  .feature-menu button svg:last-child {
    display: none;
  }
  .feature-detail {
    padding: 27px 22px;
    min-height: 430px;
  }
  .feature-detail h3 {
    font-size: 24px;
  }
  .feature-detail .btn {
    font-size: 11px;
    padding: 14px 17px;
  }
  .feature-list {
    font-size: 11px;
    line-height: 1.7;
  }
  .feature-list svg {
    flex-shrink: 0;
  }
  .trial-art {
    height: auto;
    padding: 27px;
  }
  .trial-suite {
    padding: 24px;
  }
  .trial-suite > strong {
    font-size: 26px;
  }
  .trial-suite > div {
    font-size: 12px;
  }
}
</style>
