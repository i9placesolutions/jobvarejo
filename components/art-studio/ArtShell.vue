<script setup lang="ts">
const auth = useAuth()
defineProps<{ active?: string }>()
</script>
<template>
  <div class="art-shell">
    <header class="art-header">
      <NuxtLink to="/art-studio" class="art-brand"
        ><span class="art-mark">a<span>✳</span></span
        ><span>JobVarejo <b>Estúdio de Artes</b></span></NuxtLink
      >
      <nav aria-label="Estúdio de Artes">
        <NuxtLink to="/art-studio" :class="{ current: active === 'catalog' }"
          >Explorar designs</NuxtLink
        ><NuxtLink
          to="/art-studio?tab=mine"
          :class="{ current: active === 'mine' }"
          >Minhas artes</NuxtLink
        ><NuxtLink
          v-if="auth.isSuperAdmin.value"
          to="/art-studio?tab=admin"
          :class="{ current: active === 'admin' }"
          >Administrar</NuxtLink
        >
      </nav>
      <NuxtLink to="/" class="art-back">Voltar ao sistema ↗</NuxtLink>
    </header>
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
  --art-ink: #203c30;
  --art-muted: #728077;
  --art-line: #dce2d9;
  --art-accent: #245c43;
  min-height: 100vh;
  background: #f9faf6;
  color: var(--art-ink);
  font-family: 'Art Barlow', Barlow, Arial, sans-serif;
}
.art-shell * {
  box-sizing: border-box;
}
.art-header {
  height: 88px;
  border-bottom: 1px solid var(--art-line);
  display: flex;
  align-items: center;
  gap: 38px;
  padding: 0 4vw;
  background: #fff;
}
.art-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-decoration: none;
  font-size: 13px;
}
.art-brand b {
  display: block;
  font-size: 18px;
  letter-spacing: -0.4px;
}
.art-mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #254c3a;
  color: #e9f4bd;
  font-size: 34px;
  line-height: 40px;
  text-align: center;
  font-weight: 700;
  position: relative;
}
.art-mark span {
  font-size: 19px;
  position: absolute;
  right: 3px;
  top: -8px;
}
.art-header nav {
  display: flex;
  gap: 26px;
  margin: auto;
  font-size: 14px;
  font-weight: 600;
}
.art-header nav a {
  padding: 10px 0;
  color: #758177;
  text-decoration: none;
  border-bottom: 2px solid transparent;
}
.art-header nav a.current {
  color: #234c38;
  border-color: #234c38;
}
.art-back {
  font-size: 13px;
  color: #67756b;
  text-decoration: none;
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
  transition:
    background 0.15s,
    transform 0.15s;
}
.art-shell button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.art-button {
  border: 1px solid var(--art-line);
  border-radius: 10px;
  padding: 10px 16px;
  background: white;
  color: var(--art-ink);
  font-weight: 600;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-decoration: none;
}
.art-button:hover {
  background: #edf1e8;
}
.art-button.primary {
  background: var(--art-accent);
  border-color: var(--art-accent);
  color: #fff;
}
.art-button.primary:hover {
  background: #183e2c;
}
.art-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--art-line);
  border-radius: 8px;
  background: white;
  font: inherit;
  font-size: 14px;
  color: var(--art-ink);
}
.art-alert {
  padding: 12px 16px;
  background: #fff1da;
  color: #775323;
  border: 1px solid #edd4aa;
  border-radius: 10px;
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
    min-height: 76px;
    flex-wrap: wrap;
    padding: 16px 20px;
    gap: 14px;
  }
  .art-header nav {
    order: 3;
    width: 100%;
    gap: 24px;
    overflow: auto;
    font-size: 13px;
  }
  .art-back {
    margin-left: auto;
  }
  .art-brand b {
    font-size: 16px;
  }
}
</style>
