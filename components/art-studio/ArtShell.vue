<script setup lang="ts">
defineProps<{
  active?: string
  /** Quando true, usa só o conteúdo (a Central/AdminWorkspaceShell já traz a chrome). */
  embedded?: boolean
}>()

const auth = useAuth()
</script>

<template>
  <div :class="['art-shell', { 'art-shell--embedded': embedded }]">
    <header v-if="!embedded" class="art-header">
      <NuxtLink to="/art-studio" class="art-brand" aria-label="Estúdio de Artes">
        <img src="/img/jobvarejo-logo-trim.png" alt="JobVarejo" width="142" height="45">
        <span class="art-brand-copy">
          <strong>Estúdio de Artes</strong>
          <small>Designs editáveis</small>
        </span>
      </NuxtLink>
      <nav aria-label="Estúdio de Artes">
        <NuxtLink to="/art-studio" :class="{ current: active === 'catalog' }">Explorar designs</NuxtLink>
        <NuxtLink to="/art-studio?tab=mine" :class="{ current: active === 'mine' }">Minhas artes</NuxtLink>
        <NuxtLink
          v-if="auth.isSuperAdmin.value"
          to="/art-studio?tab=admin"
          :class="{ current: active === 'admin' }"
        >
          Administrar
        </NuxtLink>
      </nav>
      <NuxtLink to="/" class="art-back">Voltar à Central</NuxtLink>
    </header>

    <nav v-else class="art-tabs" aria-label="Estúdio de Artes">
      <NuxtLink to="/art-studio" :class="{ current: active === 'catalog' }">Explorar designs</NuxtLink>
      <NuxtLink to="/art-studio?tab=mine" :class="{ current: active === 'mine' }">Minhas artes</NuxtLink>
      <NuxtLink
        v-if="auth.isSuperAdmin.value"
        to="/art-studio?tab=admin"
        :class="{ current: active === 'admin' }"
      >
        Administrar
      </NuxtLink>
    </nav>

    <slot />
  </div>
</template>

<style>
@font-face {
  font-family: 'Art Anton';
  src: url('/art-studio/fonts/Anton-Regular.ttf');
  font-weight: 400 800;
  font-display: swap;
}
@font-face {
  font-family: 'Art Oswald';
  src: url('/art-studio/fonts/Oswald%5Bwght%5D.ttf');
  font-weight: 200 700;
  font-display: swap;
}
@font-face {
  font-family: 'Art Barlow';
  src: url('/art-studio/fonts/Barlow-Regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Art Barlow';
  src: url('/art-studio/fonts/Barlow-SemiBold.ttf') format('truetype');
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: 'Art Barlow';
  src: url('/art-studio/fonts/Barlow-Bold.ttf') format('truetype');
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: 'Art Barlow';
  src: url('/art-studio/fonts/Barlow-ExtraBold.ttf') format('truetype');
  font-weight: 800;
  font-display: swap;
}
@font-face {
  font-family: 'Art Barlow Condensed';
  src: url('/art-studio/fonts/BarlowCondensed-Regular.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Art Barlow Condensed';
  src: url('/art-studio/fonts/BarlowCondensed-SemiBold.ttf') format('truetype');
  font-weight: 600;
  font-display: swap;
}
@font-face {
  font-family: 'Art Barlow Condensed';
  src: url('/art-studio/fonts/BarlowCondensed-Bold.ttf') format('truetype');
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: 'Art Barlow Condensed';
  src: url('/art-studio/fonts/BarlowCondensed-ExtraBold.ttf') format('truetype');
  font-weight: 800;
  font-display: swap;
}

.art-shell {
  --jv-navy: #173d70;
  --jv-blue: #2160b4;
  --jv-sky: #eaf3ff;
  --jv-ink: #172b45;
  --jv-muted: #60758f;
  --jv-line: #d7e4f1;
  --art-ink: var(--jv-ink);
  --art-muted: var(--jv-muted);
  --art-line: var(--jv-line);
  --art-accent: var(--jv-blue);
  min-height: 100vh;
  color: var(--art-ink);
  background:
    radial-gradient(circle at 8% -12%, rgba(58, 131, 213, .18), transparent 31rem),
    radial-gradient(circle at 104% 24%, rgba(33, 96, 180, .1), transparent 27rem),
    linear-gradient(180deg, #f8fbff 0%, #f3f7fb 100%);
  font-family: "Plus Jakarta Sans", "Barlow", "Art Barlow", ui-sans-serif, system-ui, sans-serif;
}

.art-shell--embedded {
  min-height: 100%;
  background: transparent;
}

.art-shell * {
  box-sizing: border-box;
}

.art-header {
  height: 72px;
  border-bottom: 1px solid rgba(190, 211, 233, .76);
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 0 24px;
  background: rgba(255, 255, 255, .84);
  box-shadow: 0 8px 28px rgba(26, 68, 113, .045);
  backdrop-filter: blur(18px);
}

.art-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-decoration: none;
}

.art-brand img {
  display: block;
  height: 36px;
  width: auto;
}

.art-brand-copy {
  display: grid;
  gap: 2px;
  padding-left: 12px;
  border-left: 1px solid var(--jv-line);
  line-height: 1.1;
}

.art-brand-copy strong {
  color: #1d3f69;
  font-size: 12px;
  font-weight: 800;
}

.art-brand-copy small {
  color: #8093a9;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.art-header nav,
.art-tabs {
  display: flex;
  gap: 8px;
  margin: auto;
  font-size: 13px;
  font-weight: 700;
}

.art-tabs {
  margin: 0;
  padding: 16px 24px 0;
  max-width: 1600px;
  width: 100%;
}

.art-header nav a,
.art-tabs a {
  padding: 8px 14px;
  color: var(--jv-muted);
  text-decoration: none;
  border-radius: 999px;
  border: 1px solid transparent;
}

.art-header nav a.current,
.art-tabs a.current {
  color: var(--jv-blue);
  background: var(--jv-sky);
  border-color: #c5daf3;
}

.art-back {
  font-size: 13px;
  font-weight: 700;
  color: var(--jv-muted);
  text-decoration: none;
}

.art-back:hover {
  color: var(--jv-blue);
}

.art-shell button,
.art-shell a,
.art-shell input,
.art-shell select,
.art-shell textarea {
  outline-offset: 4px;
}

.art-shell button {
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, border-color 0.15s;
}

.art-shell button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.art-button {
  border: 1px solid var(--art-line);
  border-radius: 12px;
  padding: 10px 16px;
  background: white;
  color: var(--art-ink);
  font-weight: 700;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
}

.art-button:hover {
  background: var(--jv-sky);
}

.art-button.primary {
  background: var(--art-accent);
  border-color: var(--art-accent);
  color: #fff;
  box-shadow: 0 8px 18px rgba(33, 96, 180, 0.22);
}

.art-button.primary:hover {
  background: #1a4f96;
}

.art-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--art-line);
  border-radius: 12px;
  background: #f7fbff;
  font: inherit;
  font-size: 14px;
  color: var(--art-ink);
}

.art-input:focus {
  outline: none;
  border-color: #8fb8e6;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(55, 119, 194, 0.11);
}

.art-alert {
  padding: 12px 16px;
  background: rgba(254, 243, 199, 0.75);
  color: #92400e;
  border: 1px solid rgba(217, 119, 6, 0.25);
  border-radius: 14px;
  font-size: 14px;
}

.art-empty {
  padding: 65px 20px;
  text-align: center;
  color: var(--art-muted);
}

@media (max-width: 760px) {
  .art-header {
    height: auto;
    min-height: 64px;
    flex-wrap: wrap;
    padding: 14px 16px;
    gap: 12px;
  }
  .art-header nav,
  .art-tabs {
    order: 3;
    width: 100%;
    margin: 0;
    gap: 8px;
    overflow: auto;
    font-size: 12px;
  }
  .art-tabs {
    padding: 12px 16px 0;
  }
  .art-back {
    margin-left: auto;
  }
}
</style>
