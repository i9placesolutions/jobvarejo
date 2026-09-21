<script setup lang="ts">
defineProps<{ active?: 'catalog' | 'mine' | 'editor' }>()
</script>

<template>
  <div class="cartazista-shell">
    <header class="cartazista-header">
      <NuxtLink to="/cartazista" class="cartazista-brand" aria-label="Cartazes do JobVarejo">
        <span class="cartazista-mark">$</span>
        <span>
          <strong>JobVarejo</strong>
          <small>Cartazes online</small>
        </span>
      </NuxtLink>
      <nav aria-label="Cartazes online">
        <NuxtLink to="/cartazista" :class="{ current: active === 'catalog' }">Modelos</NuxtLink>
        <NuxtLink to="/cartazista?tab=mine" :class="{ current: active === 'mine' }">Meus cartazes</NuxtLink>
      </nav>
      <NuxtLink to="/" class="cartazista-back">Voltar ao sistema ↗</NuxtLink>
    </header>
    <slot />
  </div>
</template>

<style>
.cartazista-shell {
  --cartaz-ink: #142030;
  --cartaz-muted: #6e7d8e;
  --cartaz-line: #dce4ec;
  --cartaz-blue: #2476e8;
  min-height: 100vh;
  background: #f5f8fb;
  color: var(--cartaz-ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.cartazista-shell *, .cartazista-shell *::before, .cartazista-shell *::after { box-sizing: border-box; }
.cartazista-header {
  min-height: 76px;
  padding: 0 clamp(18px, 4vw, 64px);
  display: flex;
  align-items: center;
  gap: 34px;
  background: rgba(255,255,255,.96);
  border-bottom: 1px solid var(--cartaz-line);
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(16px);
}
.cartazista-brand { display: inline-flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; min-width: 192px; }
.cartazista-brand strong { display: block; font-size: 15px; letter-spacing: -.02em; }
.cartazista-brand small { display: block; color: var(--cartaz-muted); font-size: 12px; margin-top: 2px; }
.cartazista-mark { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: linear-gradient(135deg,#2f8af5,#1453b8); color: #fff; font-size: 22px; font-weight: 800; box-shadow: 0 8px 20px #2476e830; }
.cartazista-header nav { display: flex; align-items: center; gap: 24px; margin: auto; }
.cartazista-header nav a { color: #758394; text-decoration: none; font-size: 14px; font-weight: 700; padding: 27px 0 22px; border-bottom: 3px solid transparent; transition: color .2s ease, border-color .2s ease; }
.cartazista-header nav a:hover, .cartazista-header nav a.current { color: #1559b5; border-color: #2d82ee; }
.cartazista-back { color: #667688; text-decoration: none; font-size: 13px; font-weight: 600; white-space: nowrap; }
.cartazista-button { border: 0; border-radius: 12px; padding: 12px 17px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; text-decoration: none; transition: transform .2s ease, box-shadow .2s ease, background .2s ease; }
.cartazista-button:hover { transform: translateY(-1px); }
.cartazista-button.primary { color: white; background: linear-gradient(135deg,#328bf3,#1d5fca); box-shadow: 0 12px 26px #2476e830; }
.cartazista-button.secondary { color: #1d5da9; background: #e9f2ff; }
.cartazista-button.ghost { color: #56677a; background: transparent; border: 1px solid var(--cartaz-line); }
.cartazista-button.danger { color: #b12537; background: #fff0f1; }
.cartazista-button:disabled { opacity: .55; cursor: not-allowed; transform: none; box-shadow: none; }
@media (max-width: 720px) {
  .cartazista-header { gap: 14px; min-height: 68px; }
  .cartazista-brand { min-width: 0; }
  .cartazista-brand small, .cartazista-back { display: none; }
  .cartazista-header nav { gap: 14px; }
  .cartazista-header nav a { padding: 23px 0 18px; font-size: 12px; }
}
</style>
