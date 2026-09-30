<script setup lang="ts">
import { ACCESS_ACTIONS, ACCESS_AREAS, ACCESS_AREA_ACTIONS, type AccessAction, type AccessArea, type EditorPermissions } from '~/shared/access-control'
import type { UserRole } from '~/types/auth'
import AdminWorkspaceShell from '~/components/AdminWorkspaceShell.vue'

definePageMeta({ layout: false, middleware: ['auth', 'admin'], ssr: false })
useHead({ title: 'Usuários e acessos | JobVarejo' })

type ManagedUser = {
  id: string
  name: string
  email: string
  company_name: string | null
  internal_only: boolean
  whatsapp: string | null
  role: UserRole
  is_active: boolean
  permissions: EditorPermissions
  created_at: string
  last_login_at: string | null
}

const auth = useAuth()
const users = ref<ManagedUser[]>([])
const search = ref('')
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const editingId = ref<string | null>(null)
const editingInternalOnly = ref(false)
const editingSuperAdmin = ref(false)
const form = reactive({ name: '', companyName: '', email: '', whatsapp: '', password: '', role: 'user' as UserRole, hasPlatformAccess: false, is_active: true })
const requiresLogin = computed(() => form.role !== 'user' || form.hasPlatformAccess)
const permissions = reactive<Record<AccessArea, Record<AccessAction, boolean>>>(Object.fromEntries(
  ACCESS_AREAS.map(area => [area.id, Object.fromEntries(ACCESS_ACTIONS.map(action => [action.id, false]))])
) as Record<AccessArea, Record<AccessAction, boolean>>)

const canManage = (user: ManagedUser) => auth.isSuperAdmin.value || (auth.isAdmin.value && user.role !== 'super_admin' && user.role !== 'admin')
const roles = computed(() => editingSuperAdmin.value
  ? [{ value: 'super_admin', label: 'Super admin' }]
  : auth.isSuperAdmin.value
  ? [{ value: 'user', label: 'Usuário comum' }, { value: 'editor', label: 'Editor' }, { value: 'admin', label: 'Administrador' }]
  : [{ value: 'user', label: 'Usuário comum' }, { value: 'editor', label: 'Editor' }])

const clearPermissions = () => {
  for (const area of ACCESS_AREAS) for (const action of ACCESS_ACTIONS) permissions[area.id][action.id] = false
}
const resetForm = () => {
  editingId.value = null
  editingInternalOnly.value = false
  editingSuperAdmin.value = false
  Object.assign(form, { name: '', companyName: '', email: '', whatsapp: '', password: '', role: 'user', hasPlatformAccess: false, is_active: true })
  clearPermissions()
  error.value = ''
}
const editUser = (user: ManagedUser) => {
  if (!canManage(user)) return
  editingId.value = user.id
  editingInternalOnly.value = user.internal_only === true
  editingSuperAdmin.value = user.role === 'super_admin'
  Object.assign(form, { name: user.internal_only ? '' : user.name, companyName: user.company_name || '', email: user.email, whatsapp: user.whatsapp || '', password: '', role: user.role, hasPlatformAccess: !user.internal_only, is_active: user.is_active })
  clearPermissions()
  for (const area of ACCESS_AREAS) for (const action of ACCESS_ACTIONS) {
    permissions[area.id][action.id] = user.permissions?.[area.id]?.[action.id] === true
  }
  error.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
const load = async () => {
  loading.value = true
  try {
    users.value = (await $fetch<{ users: ManagedUser[] }>('/api/admin/users', { query: { search: search.value } })).users
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || 'Não foi possível carregar os usuários.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(load, 250)
})
onUnmounted(() => { if (searchTimer) clearTimeout(searchTimer) })

const selectedPermissions = (): EditorPermissions => {
  const selected: EditorPermissions = {}
  for (const area of ACCESS_AREAS) {
    const actions = Object.fromEntries(
      ACCESS_ACTIONS.filter(action => permissions[area.id][action.id]).map(action => [action.id, true])
    )
    if (Object.keys(actions).length) selected[area.id] = actions
  }
  return selected
}

const save = async () => {
  if (saving.value) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    if (editingId.value) {
      await $fetch(`/api/admin/users/${editingId.value}`, {
        method: 'PATCH',
        body: {
          name: form.name,
          companyName: form.companyName,
          hasPlatformAccess: form.hasPlatformAccess,
          email: form.email,
          whatsapp: form.whatsapp,
          role: form.role,
          is_active: form.is_active,
          permissions: selectedPermissions(),
          ...(form.password ? { password: form.password } : {})
        }
      })
      if (editingId.value === auth.user.value?.id) await auth.getSession()
      notice.value = editingInternalOnly.value && form.hasPlatformAccess ? 'Acesso à plataforma habilitado.' : 'Cadastro atualizado.'
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: { ...form, permissions: selectedPermissions() }
      })
      notice.value = form.role === 'user' ? 'Empresa criada. Ela já está disponível para os editores.' : 'Usuário criado.'
    }
    resetForm()
    await load()
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || 'Não foi possível salvar o usuário.'
  } finally {
    saving.value = false
  }
}

const roleLabel = (role: UserRole) => ({ super_admin: 'Super admin', admin: 'Administrador', editor: 'Editor', user: 'Usuário comum' })[role]
</script>

<template>
  <AdminWorkspaceShell>
    <main class="users-page">
      <header class="users-heading">
        <div>
          <p>Administração</p>
          <h1>Usuários e níveis de acesso</h1>
          <span>Administradores acessam todas as contas. Editores recebem permissões por área. Usuários comuns criam apenas seus próprios materiais.</span>
        </div>
      </header>

      <p v-if="notice" class="users-notice" role="status">{{ notice }}</p>
      <p v-if="error" class="users-error" role="alert">{{ error }}</p>

      <section class="users-card" aria-label="Cadastro de empresa ou usuário">
        <div class="users-section-heading">
          <h2>{{ editingId ? 'Editar usuário' : form.role === 'user' ? 'Criar empresa' : 'Criar usuário' }}</h2>
          <button v-if="editingId" type="button" @click="resetForm">Cancelar edição</button>
        </div>
        <form class="users-form" @submit.prevent="save">
          <label v-if="form.role === 'user' || editingSuperAdmin">Nome da empresa <input v-model="form.companyName" :required="form.role === 'user'" minlength="2" maxlength="160" autocomplete="organization" placeholder="Ex.: Mercado Central"></label>
          <label>Nível de acesso
            <select v-model="form.role" :disabled="editingInternalOnly || editingSuperAdmin">
              <option v-for="role in roles" :key="role.value" :value="role.value">{{ role.label }}</option>
            </select>
          </label>
          <label v-if="form.role === 'user'" class="users-checkbox">
            <input v-model="form.hasPlatformAccess" type="checkbox" :disabled="!!editingId && !editingInternalOnly">
            Permitir acesso à plataforma
          </label>
          <p v-if="form.role === 'user' && !requiresLogin" class="users-help">Uso interno: a empresa ficará disponível para administradores e editores, sem login próprio.</p>
          <template v-if="requiresLogin">
            <label>{{ form.role === 'user' ? 'Nome do responsável' : 'Nome' }} <input v-model="form.name" required minlength="2" maxlength="120" autocomplete="off"></label>
            <label>E-mail <input v-model="form.email" required type="email" :disabled="!!editingId && !editingInternalOnly" autocomplete="off"></label>
            <label>WhatsApp para entrar <input v-model="form.whatsapp" required type="tel" :disabled="!!editingId && !editingInternalOnly" placeholder="(64) 99999-9999" autocomplete="off"></label>
            <label>{{ editingId && !editingInternalOnly ? 'Nova senha (opcional)' : 'Senha inicial' }} <input v-model="form.password" type="password" :required="!editingId || editingInternalOnly" minlength="8" autocomplete="new-password"></label>
          </template>
          <label v-if="editingId" class="users-checkbox"><input v-model="form.is_active" type="checkbox" :disabled="editingSuperAdmin || editingId === auth.user.value?.id"> Usuário ativo</label>

          <fieldset v-if="form.role === 'editor'" class="users-permissions">
            <legend>Permissões do editor</legend>
            <p>Marque as ações permitidas em cada área. O editor pode escolher qualquer conta de cliente, mas só executa estas ações.</p>
            <div class="users-permissions-table">
              <div class="users-permissions-row users-permissions-head"><span>Área</span><span v-for="action in ACCESS_ACTIONS" :key="action.id">{{ action.label }}</span></div>
              <div v-for="area in ACCESS_AREAS" :key="area.id" class="users-permissions-row">
                <strong>{{ area.label }}</strong>
                <label v-for="action in ACCESS_ACTIONS" :key="action.id" :aria-label="`${action.label} ${area.label}`">
                  <input v-model="permissions[area.id][action.id]" type="checkbox" :disabled="!ACCESS_AREA_ACTIONS[area.id].includes(action.id)">
                </label>
              </div>
            </div>
          </fieldset>

          <button class="users-save" type="submit" :disabled="saving">{{ saving ? 'Salvando…' : editingId ? 'Salvar acesso' : form.role === 'user' ? 'Criar empresa' : 'Criar usuário' }}</button>
        </form>
      </section>

      <section class="users-card" aria-label="Usuários cadastrados">
        <div class="users-section-heading"><h2>Usuários cadastrados</h2><span>{{ users.length }}</span></div>
        <input v-model="search" class="users-search" type="search" placeholder="Buscar empresa, nome, e-mail ou WhatsApp" aria-label="Buscar usuários">
        <p v-if="loading">Carregando usuários…</p>
        <div v-else class="users-list">
          <article v-for="user in users" :key="user.id" class="users-list-item">
            <div><strong>{{ user.company_name || user.name || user.email }}</strong><small>{{ user.internal_only ? 'Uso interno · sem acesso à plataforma' : `${user.name} · ${user.email} · ${user.whatsapp || 'Sem WhatsApp'}` }}</small></div>
            <span class="users-role">{{ roleLabel(user.role) }}</span>
            <span :class="user.is_active ? 'users-active' : 'users-inactive'">{{ user.is_active ? 'Ativo' : 'Desativado' }}</span>
            <button v-if="canManage(user)" type="button" @click="editUser(user)">Editar</button>
          </article>
        </div>
      </section>
    </main>
  </AdminWorkspaceShell>
</template>

<style scoped>
.users-page { width: min(1120px, 100%); margin: 0 auto; padding: 30px 24px 60px; color: #172b45; }
.users-heading { margin-bottom: 22px; }
.users-heading p { margin: 0 0 5px; color: #2563eb; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
.users-heading h1 { margin: 0 0 7px; font-size: clamp(25px, 3vw, 36px); font-weight: 800; }
.users-heading span { color: #64748b; }
.users-card { margin-top: 18px; padding: 22px; border: 1px solid #dbe5f0; border-radius: 18px; background: #fff; box-shadow: 0 10px 35px #172b4509; }
.users-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.users-section-heading h2 { margin: 0; font-size: 19px; font-weight: 800; }
.users-section-heading button, .users-list-item button { color: #2563eb; font-weight: 700; }
.users-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.users-form > label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 700; }
.users-help { grid-column: 1 / -1; margin: -4px 0 0; color: #64748b; font-size: 13px; }
.users-form input:not([type=checkbox]), .users-form select, .users-search { box-sizing: border-box; width: 100%; height: 42px; min-height: 42px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; font-size: 14px; line-height: 20px; }
.users-form select { appearance: none; padding-right: 36px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 11px center; background-size: 16px 16px; }
.users-form input:disabled, .users-form select:disabled { background-color: #f1f5f9; }
.users-form .users-checkbox { flex-direction: row; align-items: center; }
.users-permissions { grid-column: 1 / -1; min-width: 0; padding: 16px; border: 1px solid #dbe5f0; border-radius: 12px; }
.users-permissions legend { padding: 0 5px; font-size: 15px; font-weight: 800; }
.users-permissions p { margin: 0 0 14px; color: #64748b; font-size: 13px; }
.users-permissions-table { overflow-x: auto; }
.users-permissions-row { display: grid; grid-template-columns: minmax(180px, 1fr) repeat(4, 80px); align-items: center; min-height: 42px; border-top: 1px solid #e2e8f0; }
.users-permissions-row > :not(:first-child) { text-align: center; }
.users-permissions-row label { display: flex; justify-content: center; }
.users-permissions-row input { width: 17px; height: 17px; }
.users-permissions-head { color: #64748b; font-size: 12px; font-weight: 800; }
.users-save { grid-column: 1 / -1; justify-self: start; min-height: 42px; padding: 0 20px; border-radius: 10px; background: #2563eb; color: white; font-weight: 800; }
.users-save:disabled { opacity: .6; }
.users-list-item { display: grid; grid-template-columns: minmax(0, 1fr) 130px 100px 60px; align-items: center; gap: 12px; padding: 13px 0; border-top: 1px solid #e2e8f0; }
.users-search { margin-bottom: 15px; }
.users-list-item div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.users-list-item small { color: #64748b; overflow-wrap: anywhere; }
.users-role, .users-active, .users-inactive { font-size: 12px; font-weight: 800; }
.users-active { color: #047857; } .users-inactive { color: #b91c1c; }
.users-notice, .users-error { padding: 10px 14px; border-radius: 9px; }
.users-notice { background: #ecfdf5; color: #047857; } .users-error { background: #fef2f2; color: #b91c1c; }
@media (max-width: 700px) { .users-page { padding: 18px 12px 40px; } .users-card { padding: 15px; } .users-form { grid-template-columns: 1fr; } .users-list-item { grid-template-columns: 1fr auto; } }
</style>
