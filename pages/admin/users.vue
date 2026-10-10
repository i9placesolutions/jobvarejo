<script setup lang="ts">
import { ACCESS_ACTIONS, ACCESS_AREAS, ACCESS_AREA_ACTIONS, type AccessAction, type AccessArea, type EditorPermissions } from '~/shared/access-control'
import type { UserRole } from '~/types/auth'
import AdminWorkspaceShell from '~/components/AdminWorkspaceShell.vue'
import { Eye, EyeOff, Plus, Search, Users, X } from 'lucide-vue-next'
import { formatBrazilWhatsApp } from '~/utils/whatsapp-auth'

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
const showForm = ref(false)
const formPanel = ref<HTMLElement | null>(null)
const createButton = ref<HTMLButtonElement | null>(null)
const roleFilter = ref('')
const statusFilter = ref('')
const filteredUsers = computed(() => users.value.filter(user =>
  (!roleFilter.value || user.role === roleFilter.value)
  && (!statusFilter.value || (statusFilter.value === 'active' ? user.is_active : !user.is_active))
))
const focusForm = async () => {
  showForm.value = true
  await nextTick()
  formPanel.value?.scrollIntoView({ block: 'start', behavior: 'instant' })
  formPanel.value?.querySelector<HTMLInputElement>('input:not([disabled])')?.focus({ preventScroll: true })
}
const closeForm = () => {
  showForm.value = false
  createButton.value?.focus()
}
const clearFilters = () => { search.value = ''; roleFilter.value = ''; statusFilter.value = '' }

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const editingId = ref<string | null>(null)
const editingInternalOnly = ref(false)
const editingSuperAdmin = ref(false)
const passwordVisible = ref(false)
const actionBusy = ref(false)
const removalTarget = ref<ManagedUser | null>(null)
const removalConfirmation = ref('')
const form = reactive({ name: '', companyName: '', email: '', whatsapp: '', password: '', role: 'user' as UserRole, hasPlatformAccess: false })
const requiresLogin = computed(() => form.role !== 'user' || form.hasPlatformAccess)
const editingUser = computed(() => users.value.find(user => user.id === editingId.value) || null)
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
  passwordVisible.value = false
  Object.assign(form, { name: '', companyName: '', email: '', whatsapp: '', password: '', role: 'user', hasPlatformAccess: false })
  clearPermissions()
  error.value = ''
}
const editUser = (user: ManagedUser) => {
  if (!canManage(user)) return
  editingId.value = user.id
  editingInternalOnly.value = user.internal_only === true
  editingSuperAdmin.value = user.role === 'super_admin'
  passwordVisible.value = false
  Object.assign(form, { name: user.internal_only ? '' : user.name, companyName: user.company_name || '', email: user.email, whatsapp: formatBrazilWhatsApp(user.whatsapp || ''), password: '', role: user.role, hasPlatformAccess: !user.internal_only })
  clearPermissions()
  for (const area of ACCESS_AREAS) for (const action of ACCESS_ACTIONS) {
    permissions[area.id][action.id] = user.permissions?.[area.id]?.[action.id] === true
  }
  error.value = ''
  void focusForm()
}
const formatWhatsAppInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  form.whatsapp = formatBrazilWhatsApp(input.value)
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
  if (saving.value || actionBusy.value) return
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
          whatsapp: form.whatsapp,
          role: form.role,
          permissions: selectedPermissions(),
          ...(form.password ? { password: form.password } : {})
        }
      })
      if (editingId.value === auth.user.value?.id) await auth.getSession()
      notice.value = editingInternalOnly.value && form.hasPlatformAccess ? 'Acesso à plataforma habilitado.' : 'Cadastro atualizado.'
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: { ...form, email: form.role === 'user' ? '' : form.email, permissions: selectedPermissions() }
      })
      notice.value = form.role === 'user' ? 'Empresa criada. Ela já está disponível para os editores.' : 'Usuário criado.'
    }
    resetForm()
    closeForm()
    await load()
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || 'Não foi possível salvar o usuário.'
  } finally {
    saving.value = false
  }
}

const roleLabel = (role: UserRole) => ({ super_admin: 'Super admin', admin: 'Administrador', editor: 'Editor', user: 'Usuário comum' })[role]
const userDisplayName = (user: ManagedUser) => user.company_name || user.name || user.email
const canAdministerAccount = (user: ManagedUser) => auth.isSuperAdmin.value
  && user.role !== 'super_admin'
  && user.id !== auth.user.value?.id

const changeUserStatus = async (user: ManagedUser) => {
  if (!canAdministerAccount(user) || actionBusy.value || saving.value) return
  actionBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    await $fetch(`/api/admin/users/${user.id}/status`, {
      method: 'PATCH',
      body: { is_active: !user.is_active }
    })
    if (editingId.value === user.id) resetForm()
    notice.value = user.is_active
      ? `Acesso de ${userDisplayName(user)} bloqueado.`
      : `Acesso de ${userDisplayName(user)} desbloqueado.`
    await load()
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || 'Não foi possível alterar o acesso deste usuário.'
  } finally {
    actionBusy.value = false
  }
}

const openRemovalConfirmation = (user: ManagedUser) => {
  if (!canAdministerAccount(user) || actionBusy.value || saving.value) return
  error.value = ''
  removalConfirmation.value = ''
  removalTarget.value = user
}

const cancelRemoval = () => {
  if (actionBusy.value) return
  removalTarget.value = null
  removalConfirmation.value = ''
}

const removeUser = async () => {
  const user = removalTarget.value
  if (!user || !canAdministerAccount(user) || actionBusy.value || saving.value) return
  if (removalConfirmation.value.trim() !== userDisplayName(user).trim()) return

  actionBusy.value = true
  error.value = ''
  notice.value = ''
  try {
    await $fetch(`/api/admin/users/${user.id}`, {
      method: 'DELETE',
      body: { confirmId: user.id }
    })
    if (editingId.value === user.id) resetForm()
    notice.value = `${userDisplayName(user)} removido da listagem e com acesso revogado. Os materiais foram preservados.`
    removalTarget.value = null
    removalConfirmation.value = ''
    await load()
  } catch (cause: any) {
    error.value = cause?.data?.statusMessage || 'Não foi possível remover este usuário.'
  } finally {
    actionBusy.value = false
  }
}
</script>

<template>
  <AdminWorkspaceShell active-nav="users">
    <main class="users-page">
      <header class="users-heading">
        <div>
          <p>Administração</p>
          <h1>Usuários e níveis de acesso</h1>
          <span>Administradores acessam todas as contas. Editores recebem permissões por área. Usuários comuns criam apenas seus próprios materiais.</span>
        </div>
        <button ref="createButton" type="button" class="users-create" :aria-expanded="showForm" aria-controls="user-form-panel" @click="focusForm"><Plus :size="18" />{{ editingId ? 'Continuar edição' : 'Novo cadastro' }}</button>
      </header>

      <p v-if="notice" class="users-notice" role="status">{{ notice }}</p>
      <p v-if="error" class="users-error" role="alert">{{ error }}</p>

      <section v-show="showForm" id="user-form-panel" ref="formPanel" class="users-card users-form-panel" aria-label="Cadastro de empresa ou usuário">
        <div class="users-section-heading">
          <h2>{{ editingId ? 'Editar usuário' : form.role === 'user' ? 'Criar empresa' : 'Criar usuário' }}</h2>
          <button type="button" :disabled="saving || actionBusy" @click="resetForm(); closeForm()"><X :size="16" /> Cancelar</button>
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
            <label v-if="form.role !== 'user'">E-mail <input v-model="form.email" required type="email" :disabled="!!editingId && !editingInternalOnly" autocomplete="off"></label>
            <label>WhatsApp para entrar <input v-model="form.whatsapp" required type="tel" :disabled="!!editingId && !editingInternalOnly" placeholder="(64) 99999-9999" autocomplete="off" @input="formatWhatsAppInput"></label>
            <label>{{ editingId && !editingInternalOnly ? 'Nova senha (opcional)' : 'Senha inicial' }}
              <span class="users-password-field">
                <input v-model="form.password" :type="passwordVisible ? 'text' : 'password'" :required="!editingId || editingInternalOnly" minlength="8" autocomplete="new-password">
                <button type="button" class="users-password-toggle" :aria-label="passwordVisible ? 'Ocultar senha' : 'Mostrar senha'" :aria-pressed="passwordVisible" @click="passwordVisible = !passwordVisible">
                  <EyeOff v-if="passwordVisible" aria-hidden="true" />
                  <Eye v-else aria-hidden="true" />
                </button>
              </span>
            </label>
          </template>
          <p v-if="editingUser" class="users-help">Estado da conta: <strong :class="editingUser.is_active ? 'users-active' : 'users-inactive'">{{ editingUser.is_active ? 'Ativo' : 'Bloqueado' }}</strong>.<template v-if="canAdministerAccount(editingUser)"> Altere pela ação Bloquear ou Desbloquear na lista.</template></p>

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

          <button class="users-save" type="submit" :disabled="saving || actionBusy">{{ saving ? 'Salvando…' : editingId ? 'Salvar acesso' : form.role === 'user' ? 'Criar empresa' : 'Criar usuário' }}</button>
        </form>
      </section>

      <section class="users-card" aria-label="Usuários cadastrados">
        <div class="users-section-heading"><h2>Usuários cadastrados</h2><span role="status">{{ loading ? 'Carregando…' : `${filteredUsers.length} ${filteredUsers.length === 1 ? 'cadastro' : 'cadastros'}` }}</span></div>
        <div class="users-filters">
          <label class="users-search-wrap"><Search :size="18" aria-hidden="true" /><input v-model="search" class="users-search" type="search" placeholder="Empresa, nome, e-mail ou WhatsApp" aria-label="Buscar usuários"></label>
          <label>Nível de acesso<select v-model="roleFilter"><option value="">Todos os níveis</option><option value="user">Usuário comum</option><option value="editor">Editor</option><option value="admin">Administrador</option><option value="super_admin">Super admin</option></select></label>
          <label>Situação<select v-model="statusFilter"><option value="">Todas as situações</option><option value="active">Ativos</option><option value="blocked">Bloqueados</option></select></label>
        </div>
        <div v-if="loading" class="users-loading" role="status">Carregando usuários…</div>
        <div v-else-if="!filteredUsers.length" class="users-empty">
          <Users :size="30" aria-hidden="true" />
          <h3>{{ search || roleFilter || statusFilter ? 'Nenhum cadastro encontrado' : 'Nenhum usuário cadastrado' }}</h3>
          <p>{{ search || roleFilter || statusFilter ? 'Altere a busca ou os filtros para encontrar a conta.' : 'Use Novo cadastro para adicionar uma empresa ou pessoa.' }}</p>
          <button v-if="search || roleFilter || statusFilter" type="button" @click="clearFilters">Limpar filtros</button>
        </div>
        <div v-else class="users-list">
          <article v-for="user in filteredUsers" :key="user.id" class="users-list-item" :class="{ 'users-list-item-admin': canAdministerAccount(user) }">
            <div><strong>{{ user.company_name || user.name || user.email }}</strong><small>{{ user.internal_only ? 'Uso interno · sem acesso à plataforma' : `${user.name} · ${user.email} · ${user.whatsapp || 'Sem WhatsApp'}` }}</small></div>
            <span class="users-role">{{ roleLabel(user.role) }}</span>
            <span :class="user.is_active ? 'users-active' : 'users-inactive'">{{ user.is_active ? 'Ativo' : 'Bloqueado' }}</span>
            <button v-if="canManage(user)" type="button" @click="editUser(user)">Editar</button>
            <div v-if="canAdministerAccount(user)" class="users-admin-actions">
              <button type="button" :disabled="actionBusy || saving" @click="changeUserStatus(user)">{{ actionBusy ? 'Aguarde…' : user.is_active ? 'Bloquear' : 'Desbloquear' }}</button>
              <button type="button" class="users-remove-action" :disabled="actionBusy || saving" @click="openRemovalConfirmation(user)">Remover</button>
            </div>
          </article>
        </div>
      </section>

      <div v-if="removalTarget" class="users-dialog-backdrop" @click.self="cancelRemoval">
        <section class="users-removal-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-user-title" aria-describedby="remove-user-description">
          <h2 id="remove-user-title">Remover usuário?</h2>
          <p id="remove-user-description">
            <strong>{{ userDisplayName(removalTarget) }}</strong>
            <template v-if="removalTarget.company_name && removalTarget.name"> · {{ removalTarget.name }}</template>
            <template v-if="removalTarget.email"> · {{ removalTarget.email }}</template>
          </p>
          <p>A conta sairá da listagem e perderá o acesso à plataforma. Projetos, arquivos e demais materiais serão preservados.</p>
          <p v-if="error" class="users-error" role="alert">{{ error }}</p>
          <label>Digite <strong>{{ userDisplayName(removalTarget) }}</strong> para confirmar
            <input v-model="removalConfirmation" type="text" autocomplete="off" :disabled="actionBusy">
          </label>
          <div class="users-dialog-actions">
            <button type="button" :disabled="actionBusy" @click="cancelRemoval">Cancelar</button>
            <button type="button" class="users-remove-action" :disabled="actionBusy || removalConfirmation.trim() !== userDisplayName(removalTarget).trim()" @click="removeUser">{{ actionBusy ? 'Removendo…' : 'Remover usuário' }}</button>
          </div>
        </section>
      </div>
    </main>
  </AdminWorkspaceShell>
</template>

<style scoped>
.users-create { display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0; min-height: 44px; padding: 10px 16px; border-radius: 9px; background: #2160b4; color: white; font-size: 13px; font-weight: 700; cursor: pointer; }
.users-create:hover { background: #173d70; }
.users-form-panel { scroll-margin-top: 16px; border-top: 3px solid #2160b4; }
.users-filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin: 18px 0; }
.users-filters > label { display: flex; flex-direction: column; gap: 5px; color: #60758f; font-size: 12px; font-weight: 600; }
.users-filters select { appearance: none; height: 42px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2360758f' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 9px center; min-height: 42px; padding: 8px 30px 8px 10px; border: 1px solid #cbd5e1; border-radius: 9px; color: #172b45; background-color: #fff; }
.users-filters .users-search-wrap { position: relative; flex: 1 1 260px; }
.users-search-wrap svg { position: absolute; left: 12px; top: 12px; }
.users-filters .users-search { padding-left: 38px; margin: 0; }
.users-empty, .users-loading { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px 16px; text-align: center; color: #60758f; font-size: 14px; }
.users-empty h3 { font-weight: 700; color: #172b45; }
.users-empty button { padding: 10px 16px; color: #2160b4; font-weight: 700; border: 1px solid #d7e4f1; border-radius: 8px; }
.users-page button:focus-visible, .users-page select:focus-visible, .users-page input:focus-visible { outline: 2px solid #2160b4; outline-offset: 2px; }
@media (max-width: 640px) { .users-page .users-heading { flex-direction: column; gap: 14px; } .users-create { width: 100%; } .users-filters > label { flex: 1 1 140px; } .users-filters select { width: 100%; font-size: 16px; } }

.users-page { width: min(1120px, 100%); min-width: 0; margin: 0 auto; padding: clamp(16px, 2vw, 28px) clamp(12px, 2vw, 24px) 32px; color: #172b45; container-type: inline-size; }
.users-heading { margin-bottom: 22px; display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.users-heading p { margin: 0 0 5px; color: #2563eb; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
.users-heading h1 { margin: 0 0 7px; font-size: clamp(21px, 2vw, 28px); font-weight: 700; line-height: 1.25; }
.users-heading span { color: #64748b; font-size: 13px; line-height: 1.5; }
.users-card { min-width: 0; margin-top: 16px; padding: clamp(14px, 1.8vw, 20px); border: 1px solid #dbe5f0; border-radius: 12px; background: #fff; }
.users-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.users-section-heading h2 { margin: 0; font-size: 16px; font-weight: 700; }
.users-section-heading button, .users-list-item button { color: #2563eb; font-weight: 700; }
.users-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.users-form > label { min-width: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 700; }
.users-help { grid-column: 1 / -1; margin: -4px 0 0; color: #64748b; font-size: 13px; }
.users-form input:not([type=checkbox]), .users-form select, .users-search { box-sizing: border-box; width: 100%; height: 42px; min-height: 42px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 9px; background: #fff; font-size: 14px; line-height: 20px; }
.users-password-field { position: relative; display: block; }
.users-password-field input { padding-right: 42px !important; }
.users-password-toggle { position: absolute; top: 50%; right: 7px; display: grid; width: 30px; height: 30px; place-items: center; transform: translateY(-50%); color: #64748b; }
.users-password-toggle svg { width: 17px; height: 17px; }
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
.users-list-item { display: grid; grid-template-columns: minmax(0, 1fr) 110px 70px auto; align-items: center; gap: 12px; padding: 13px 0; border-top: 1px solid #e2e8f0; font-size: 13px; }
.users-list-item-admin { grid-template-columns: minmax(0, 1fr) 110px 70px auto auto; }
.users-list-item .users-admin-actions { display: flex; flex-direction: row; align-items: center; gap: 10px; }
.users-admin-actions button, .users-dialog-actions button { color: #2563eb; font-weight: 700; }
.users-list-item button:disabled, .users-dialog-actions button:disabled { cursor: not-allowed; opacity: .55; }
.users-admin-actions .users-remove-action, .users-dialog-actions .users-remove-action { color: #b91c1c; }
.users-search { margin-bottom: 15px; }
.users-list-item div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.users-list-item small { color: #64748b; overflow-wrap: anywhere; }
.users-list-item strong, .users-heading, .users-help, .users-removal-dialog { overflow-wrap: anywhere; }
.users-role, .users-active, .users-inactive { font-size: 12px; font-weight: 800; }
.users-active { color: #047857; } .users-inactive { color: #b91c1c; }
.users-notice, .users-error { padding: 10px 14px; border-radius: 9px; }
.users-notice { background: #ecfdf5; color: #047857; } .users-error { background: #fef2f2; color: #b91c1c; }
.users-dialog-backdrop { position: fixed; z-index: 100; inset: 0; display: grid; place-items: center; padding: 20px; background: #0f172a88; }
.users-removal-dialog { width: min(520px, 100%); max-height: calc(100dvh - 40px); overflow-y: auto; overscroll-behavior: contain; padding: clamp(16px, 3vw, 24px); border: 1px solid #dbe5f0; border-radius: 12px; background: #fff; box-shadow: 0 24px 80px #0f172a33; }
.users-removal-dialog h2 { margin: 0 0 14px; font-size: 21px; }
.users-removal-dialog p { margin: 0 0 12px; color: #475569; line-height: 1.55; }
.users-removal-dialog label { display: flex; flex-direction: column; gap: 7px; margin-top: 18px; font-size: 13px; }
.users-removal-dialog input { box-sizing: border-box; width: 100%; height: 42px; padding: 9px 11px; border: 1px solid #cbd5e1; border-radius: 9px; font-size: 14px; }
.users-dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 16px; margin-top: 20px; }
@container (max-width: 760px) {
  .users-list-item, .users-list-item-admin { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
  .users-list-item > div:first-child, .users-list-item .users-admin-actions { grid-column: 1 / -1; }
  .users-list-item button { min-height: 36px; text-align: left; }
}
@container (max-width: 520px) {
  .users-form { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .users-section-heading { flex-wrap: wrap; margin-bottom: 14px; }
  .users-permissions { padding: 10px; }
}
@media (max-width: 1023px) {
  .users-form input:not([type=checkbox]), .users-form select, .users-search, .users-removal-dialog input { font-size: 16px; min-height: 44px; }
  .users-save, .users-admin-actions button, .users-dialog-actions button, .users-list-item > button { min-height: 44px; }
}
</style>
