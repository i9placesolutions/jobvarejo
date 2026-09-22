<script setup lang="ts">
defineProps<{
  active?: 'catalog' | 'mine' | 'editor'
  /** Quando true, a barra chrome superior é gerenciada pelo AdminWorkspaceShell */
  embedded?: boolean
}>()
</script>

<template>
  <div :class="['cartazista-shell', { 'cartazista-shell--embedded': embedded }]">
    <!-- Header Standalone (quando não estiver embedded no AdminWorkspaceShell) -->
    <header v-if="!embedded" class="cartazista-header">
      <div class="cartazista-header-inner">
        <NuxtLink to="/cartazista" class="cartazista-brand" aria-label="Cartazes JobVarejo">
          <img src="/img/jobvarejo-logo-trim.png" alt="JobVarejo" width="142" height="45" class="cartazista-brand-logo">
          <span class="cartazista-brand-copy">
            <strong>Cartazes de Oferta</strong>
            <small>Edição e Impressão</small>
          </span>
        </NuxtLink>
        <nav aria-label="Cartazes online">
          <NuxtLink to="/cartazista" :class="{ current: active === 'catalog' }">Modelos de cartaz</NuxtLink>
          <NuxtLink to="/cartazista?tab=mine" :class="{ current: active === 'mine' }">Meus cartazes</NuxtLink>
        </nav>
        <NuxtLink to="/" class="cartazista-back">
          <span>Todas as soluções</span>
          <span aria-hidden="true">↗</span>
        </NuxtLink>
      </div>
    </header>

    <!-- Sub-nav bar quando embedded no AdminWorkspaceShell -->
    <div v-else-if="active !== 'editor'" class="cartazista-subnav">
      <div class="cartazista-subnav-inner">
        <nav aria-label="Navegação de cartazes">
          <NuxtLink to="/cartazista" :class="{ current: active === 'catalog' }">Modelos de cartaz</NuxtLink>
          <NuxtLink to="/cartazista?tab=mine" :class="{ current: active === 'mine' }">Meus cartazes</NuxtLink>
        </nav>
      </div>
    </div>

    <slot />
  </div>
</template>

<style>
.cartazista-shell {
  --jv-navy: #173d70;
  --jv-blue: #2160b4;
  --jv-sky: #eaf3ff;
  --jv-ink: #172b45;
  --jv-muted: #60758f;
  --jv-line: #d7e4f1;
  --jv-border: rgba(190, 211, 233, 0.76);
  min-height: 100vh;
  background:
    radial-gradient(circle at 8% -12%, rgba(58, 131, 213, .12), transparent 31rem),
    radial-gradient(circle at 104% 24%, rgba(72, 157, 128, .08), transparent 27rem),
    linear-gradient(180deg, #f8fbff 0%, #f3f7fb 100%);
  color: var(--jv-ink);
  font-family: "Plus Jakarta Sans", "Barlow", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  position: relative;
}

.cartazista-shell--embedded {
  min-height: 100%;
  background: transparent;
}

.cartazista-shell *, .cartazista-shell *::before, .cartazista-shell *::after {
  box-sizing: border-box;
}

/* Header Standalone */
.cartazista-header {
  min-height: 72px;
  height: 72px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.88);
  border-bottom: 1px solid var(--jv-border);
  position: sticky;
  top: 0;
  z-index: 20;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 4px 20px rgba(26, 68, 113, 0.04);
}

.cartazista-header-inner {
  width: 100%;
  max-width: 1540px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.cartazista-brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: inherit;
  text-decoration: none;
}

.cartazista-brand-logo {
  height: 36px;
  width: auto;
  display: block;
}

.cartazista-brand-copy {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  padding-left: 12px;
  border-left: 1px solid var(--jv-line);
}

.cartazista-brand-copy strong {
  font-size: 13px;
  color: #16375f;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.cartazista-brand-copy small {
  margin-top: 2px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5b7ea8;
}

.cartazista-header nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 auto;
}

.cartazista-header nav a {
  color: var(--jv-muted);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.cartazista-header nav a:hover {
  color: var(--jv-blue);
  background: rgba(33, 96, 180, 0.06);
}

.cartazista-header nav a.current {
  color: #1d4ed8;
  background: var(--jv-sky);
  border-color: #c5daf3;
  font-weight: 700;
}

.cartazista-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--jv-muted);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.cartazista-back:hover {
  color: var(--jv-blue);
}

/* Sub-nav embedded (dentro de AdminWorkspaceShell) */
.cartazista-subnav {
  padding: 16px 28px 0;
  max-width: 1540px;
  margin: 0 auto;
  width: 100%;
}

.cartazista-subnav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cartazista-subnav nav {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.7);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--jv-line);
  box-shadow: 0 2px 8px rgba(26, 68, 113, 0.03);
}

.cartazista-subnav nav a {
  color: var(--jv-muted);
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 16px;
  border-radius: 9px;
  transition: all 0.15s ease;
}

.cartazista-subnav nav a:hover {
  color: var(--jv-ink);
}

.cartazista-subnav nav a.current {
  color: #1d4ed8;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(29, 78, 216, 0.12);
  font-weight: 700;
}

/* Botões do Ecossistema Cartazista */
.cartazista-button {
  border: 0;
  border-radius: 12px;
  padding: 10px 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.cartazista-button:hover {
  transform: translateY(-1px);
}

.cartazista-button:active {
  transform: translateY(0);
}

.cartazista-button.primary {
  color: white;
  background: #2563eb;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.28);
}

.cartazista-button.primary:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.36);
}

.cartazista-button.secondary {
  color: #1e40af;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}

.cartazista-button.secondary:hover {
  background: #dbeafe;
  color: #1d4ed8;
}

.cartazista-button.ghost {
  color: #475569;
  background: white;
  border: 1px solid #cbd5e1;
}

.cartazista-button.ghost:hover {
  background: #f8fafc;
  color: #0f172a;
  border-color: #94a3b8;
}

.cartazista-button.danger {
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.cartazista-button.danger:hover {
  background: #fee2e2;
}

.cartazista-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

@media (max-width: 720px) {
  .cartazista-header {
    padding: 0 16px;
    min-height: 64px;
    height: 64px;
  }
  .cartazista-brand-copy,
  .cartazista-back {
    display: none;
  }
  .cartazista-header nav {
    gap: 4px;
  }
  .cartazista-header nav a {
    padding: 6px 10px;
    font-size: 12px;
  }
}
</style>
