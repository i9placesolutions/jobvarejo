<script setup lang="ts">
import { ArrowUpRight, Grid, LayoutTemplate, SlidersHorizontal, Tag, Zap } from 'lucide-vue-next'
import type { Component } from 'vue'

const route = useRoute()

type WorkspaceTool = {
  title: string
  description: string
  to: string
  activePath?: string
  icon: Component
}

const tools: WorkspaceTool[] = [
  {
    title: 'Modelos',
    description: 'Crie e reutilize layouts completos.',
    to: '/flyer-templates',
    icon: LayoutTemplate
  },
  {
    title: 'Edição rápida',
    description: 'Preencha um modelo com as ofertas.',
    to: '/quick-editor',
    icon: Zap
  },
  {
    title: 'Etiquetas',
    description: 'Defina os selos e preços do encarte.',
    to: '/label-templates?returnTo=/flyer-templates',
    activePath: '/label-templates',
    icon: Tag
  },
  {
    title: 'Zonas',
    description: 'Ajuste a estrutura das ofertas.',
    to: '/zone-structures',
    icon: Grid
  },
  {
    title: 'Cards',
    description: 'Configure a apresentação dos produtos.',
    to: '/card-configurations',
    icon: SlidersHorizontal
  }
]

const isActive = (tool: WorkspaceTool) => route.path === (tool.activePath || tool.to)
</script>

<template>
  <section class="encarte-workspace-nav" aria-labelledby="encarte-workspace-title">
    <div class="encarte-workspace-nav__intro">
      <p class="encarte-workspace-nav__eyebrow">Área Encartes</p>
      <h2 id="encarte-workspace-title">Tudo do seu encarte, no mesmo lugar.</h2>
      <p>Comece pelo modelo e use os ajustes abaixo somente quando precisar. Vídeos e cartazes continuam em seus próprios espaços.</p>
    </div>

    <nav class="encarte-workspace-nav__items" aria-label="Ferramentas de encartes">
      <NuxtLink
        v-for="tool in tools"
        :key="tool.title"
        :to="tool.to"
        class="encarte-workspace-nav__item"
        :class="{ 'is-active': isActive(tool) }"
        :aria-current="isActive(tool) ? 'page' : undefined"
      >
        <span class="encarte-workspace-nav__icon"><component :is="tool.icon" :size="17" /></span>
        <span class="encarte-workspace-nav__copy">
          <strong>{{ tool.title }}</strong>
          <small>{{ tool.description }}</small>
        </span>
        <ArrowUpRight class="encarte-workspace-nav__arrow" :size="15" aria-hidden="true" />
      </NuxtLink>
    </nav>
  </section>
</template>

<style scoped>
.encarte-workspace-nav {
  display: grid;
  gap: 18px;
  margin-bottom: 24px;
  padding: 20px;
  border: 1px solid #dbeafe;
  border-radius: 24px;
  color: #17315f;
  background:
    radial-gradient(circle at 0% 0%, rgba(42, 113, 255, .13), transparent 33%),
    linear-gradient(135deg, #f7fbff 0%, #eef5ff 100%);
}

.encarte-workspace-nav__eyebrow {
  margin: 0;
  color: #3967bf;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
}

.encarte-workspace-nav h2 {
  margin: 5px 0 0;
  color: #142952;
  font-size: clamp(19px, 2vw, 24px);
  font-weight: 800;
  letter-spacing: -.035em;
}

.encarte-workspace-nav__intro > p:last-child {
  max-width: 640px;
  margin: 7px 0 0;
  color: #5e7195;
  font-size: 13px;
  line-height: 1.55;
}

.encarte-workspace-nav__items {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 9px;
}

.encarte-workspace-nav__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 9px;
  min-height: 76px;
  padding: 12px;
  border: 1px solid rgba(120, 156, 220, .25);
  border-radius: 16px;
  color: inherit;
  text-decoration: none;
  background: rgba(255, 255, 255, .8);
  box-shadow: 0 7px 18px rgba(39, 79, 139, .04);
  transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease, background .18s ease;
}

.encarte-workspace-nav__item:hover {
  border-color: #8bb2ff;
  background: #fff;
  box-shadow: 0 12px 24px rgba(39, 79, 139, .1);
  transform: translateY(-2px);
}

.encarte-workspace-nav__item.is-active {
  border-color: #285df0;
  color: #fff;
  background: linear-gradient(135deg, #2453df, #3a6bf6);
  box-shadow: 0 12px 24px rgba(37, 83, 223, .24);
}

.encarte-workspace-nav__icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 10px;
  color: #2d61e7;
  background: #e5efff;
}

.encarte-workspace-nav__item.is-active .encarte-workspace-nav__icon {
  color: #fff;
  background: rgba(255, 255, 255, .17);
}

.encarte-workspace-nav__copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.encarte-workspace-nav__copy strong {
  color: #183764;
  font-size: 12px;
  line-height: 1.2;
}

.encarte-workspace-nav__copy small {
  color: #6980a7;
  font-size: 10px;
  line-height: 1.35;
}

.encarte-workspace-nav__item.is-active .encarte-workspace-nav__copy strong,
.encarte-workspace-nav__item.is-active .encarte-workspace-nav__copy small {
  color: #fff;
}

.encarte-workspace-nav__arrow {
  margin-top: 2px;
  color: #90a5c9;
}

.encarte-workspace-nav__item.is-active .encarte-workspace-nav__arrow { color: #dce8ff; }

@media (max-width: 1040px) {
  .encarte-workspace-nav__items { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .encarte-workspace-nav { margin-bottom: 18px; padding: 16px; border-radius: 20px; }
  .encarte-workspace-nav__items { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .encarte-workspace-nav__item { min-height: 70px; padding: 10px; }
  .encarte-workspace-nav__copy small { display: none; }
}
</style>
