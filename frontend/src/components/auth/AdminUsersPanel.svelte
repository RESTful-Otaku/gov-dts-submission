<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { AuthUser, UserRole, UsersSortField } from '../../lib/api'
  import type { ListPageSize } from '../../lib/app/constants'
  import { setIndeterminate } from '../../lib/dom/setIndeterminate'
  import { tableSortGlyph } from '../../lib/ui/tableSortGlyph'
  import ListPagination from '../tasks/ListPagination.svelte'

  export let users: AuthUser[] = []
  export let usersTotal = 0
  export let usersLoading = false

  export let usersSearchTerm = ''
  export let usersRoleFilter: '' | UserRole = ''
  export let showUsersFilters = false
  export let onToggleUsersFilters: () => void = () => {}
  export let onClearUsersFilters: () => void = () => {}
  export let onSetUsersRoleFilter: (role: '' | UserRole) => void = () => {}

  export let usersSortKey: UsersSortField = 'created_at'
  export let usersSortAscending = false
  export let onToggleUsersSort: (field: UsersSortField) => void = () => {}

  export let usersPage = 1
  export let usersPageSize: ListPageSize = 20
  export let totalUserPages = 1
  export let LIST_PAGE_SIZES: readonly number[] = [10, 20, 50]

  export let selectedUserIds: Set<string> = new Set()
  export let onToggleUserSelection: (id: string) => void = () => {}
  export let onSelectAllUsersOnPage: () => void = () => {}
  export let onClearUserSelection: () => void = () => {}

  export let onOpenEditUser: (user: AuthUser) => void = () => {}
  export let onSetUserRole: (id: string, role: UserRole) => void = () => {}
  export let onRequestPasswordReset: (id: string) => void = () => {}
  export let onOpenDeleteOne: (id: string) => void = () => {}
  export let onOpenBulkDelete: () => void = () => {}

  $: hasUserFilters = usersSearchTerm.trim() !== '' || usersRoleFilter !== ''
  $: allOnPage = users.length > 0 && users.every((u) => selectedUserIds.has(u.id))
  $: someOnPage = users.some((u) => selectedUserIds.has(u.id)) && !allOnPage
</script>

<section class="card admin-users-card" data-tour="admin-users-panel">
  <h2 class="admin-users-title">User administration</h2>
  <p class="muted admin-users-lead">
    Search and filter accounts, update names, send password resets, adjust roles, or remove users. New accounts are not created here.
  </p>

  <div class="admin-users-toolbar">
    <label class="admin-users-search">
      <span class="visually-hidden">Search users</span>
      <input
        type="search"
        placeholder="Search email, names, display name…"
        bind:value={usersSearchTerm}
        aria-label="Search users"
      />
    </label>
    <button type="button" class="btn-secondary" aria-expanded={showUsersFilters} on:click={onToggleUsersFilters}>
      {showUsersFilters ? 'Hide filters' : 'Filters'}
    </button>
    {#if hasUserFilters}
      <button type="button" class="btn-clear-filters btn-icon-compact" on:click={onClearUsersFilters}>
        <span class="btn-icon-compact__icon" aria-hidden="true">⌫</span>
        <span class="btn-icon-compact__label">Clear filters</span>
      </button>
    {/if}
    {#if usersLoading}
      <span class="badge" aria-live="polite">Loading…</span>
    {/if}
  </div>

  {#if showUsersFilters}
    <div class="admin-users-filters card-inner" transition:fade={{ duration: 150 }}>
      <label class="control-stack">
        <span>Role</span>
        <select
          value={usersRoleFilter}
          aria-label="Filter by role"
          on:change={(e) =>
            onSetUsersRoleFilter((e.currentTarget as HTMLSelectElement).value as '' | UserRole)}
        >
          <option value="">All roles</option>
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </label>
    </div>
  {/if}

  {#if selectedUserIds.size > 0}
    <div class="bulk-actions admin-users-bulk" role="toolbar" aria-label="Bulk user actions">
      <span class="bulk-actions-label">{selectedUserIds.size} selected</span>
      <div class="bulk-actions-buttons">
        <button
          type="button"
          class="danger btn-icon-compact"
          title="Delete selected users"
          aria-label="Delete selected users"
          on:click={onOpenBulkDelete}
        >
          <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
          <span class="btn-icon-compact__label">Delete</span>
        </button>
        <button type="button" class="btn-clear-selection btn-icon-compact" on:click={onClearUserSelection} aria-label="Clear selection">
          <span class="btn-icon-compact__icon" aria-hidden="true">✕</span>
          <span class="btn-icon-compact__label">Clear</span>
        </button>
      </div>
    </div>
  {/if}

  {#if users.length > 0}
    <div class="list-select-all-bar" role="status">
      {#if allOnPage}
        <span class="list-select-all-text">All on this page selected</span>
        <button type="button" class="list-select-all-link" on:click={onSelectAllUsersOnPage}>Clear page selection</button>
      {:else}
        <span class="list-select-all-text">{users.length} on this page</span>
        <button type="button" class="list-select-all-link" on:click={onSelectAllUsersOnPage}>Select all on this page</button>
      {/if}
    </div>
  {/if}

  <div class="list-wrapper" role="region" aria-label="Users table">
    <table class="task-table admin-users-table">
      <thead>
        <tr>
          <th scope="col" class="col-select">
            <label class="select-all-label">
              <input
                type="checkbox"
                checked={allOnPage}
                use:setIndeterminate={someOnPage}
                aria-label="Select all users on this page"
                on:change={onSelectAllUsersOnPage}
              />
            </label>
          </th>
          <th scope="col">
            <button type="button" class="th-sort" on:click={() => onToggleUsersSort('created_at')}>
              Created{' '}
              <span class="th-sort__glyph" aria-hidden="true"
                >{tableSortGlyph(usersSortKey === 'created_at', usersSortAscending)}</span
              >
            </button>
          </th>
          <th scope="col">
            <button type="button" class="th-sort" on:click={() => onToggleUsersSort('updated_at')}>
              Updated{' '}
              <span class="th-sort__glyph" aria-hidden="true"
                >{tableSortGlyph(usersSortKey === 'updated_at', usersSortAscending)}</span
              >
            </button>
          </th>
          <th scope="col">
            <button type="button" class="th-sort" on:click={() => onToggleUsersSort('first_name')}>
              First name{' '}
              <span class="th-sort__glyph" aria-hidden="true"
                >{tableSortGlyph(usersSortKey === 'first_name', usersSortAscending)}</span
              >
            </button>
          </th>
          <th scope="col">
            <button type="button" class="th-sort" on:click={() => onToggleUsersSort('last_name')}>
              Last name{' '}
              <span class="th-sort__glyph" aria-hidden="true"
                >{tableSortGlyph(usersSortKey === 'last_name', usersSortAscending)}</span
              >
            </button>
          </th>
          <th scope="col">
            <button type="button" class="th-sort" on:click={() => onToggleUsersSort('username')}>
              Display{' '}
              <span class="th-sort__glyph" aria-hidden="true"
                >{tableSortGlyph(usersSortKey === 'username', usersSortAscending)}</span
              >
            </button>
          </th>
          <th scope="col">
            <button type="button" class="th-sort" on:click={() => onToggleUsersSort('email')}>
              Email{' '}
              <span class="th-sort__glyph" aria-hidden="true"
                >{tableSortGlyph(usersSortKey === 'email', usersSortAscending)}</span
              >
            </button>
          </th>
          <th scope="col">
            <button type="button" class="th-sort" on:click={() => onToggleUsersSort('role')}>
              Role{' '}
              <span class="th-sort__glyph" aria-hidden="true"
                >{tableSortGlyph(usersSortKey === 'role', usersSortAscending)}</span
              >
            </button>
          </th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#if users.length === 0}
          <tr>
            <td colspan="9" class="empty-cell">No users match the current filters.</td>
          </tr>
        {:else}
          {#each users as u (u.id)}
            <tr class:row-selected={selectedUserIds.has(u.id)}>
              <td class="col-select">
                <label class="row-select-label">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(u.id)}
                    aria-label={`Select ${u.username}`}
                    on:change={() => onToggleUserSelection(u.id)}
                  />
                </label>
              </td>
              <td>{new Date(u.createdAt).toLocaleString()}</td>
              <td>{new Date(u.updatedAt).toLocaleString()}</td>
              <td>{u.firstName}</td>
              <td>{u.lastName}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>
                <div class="user-role-icon-group" role="group" aria-label={`Role for ${u.username}`}>
                  <button
                    type="button"
                    class="user-role-icon"
                    class:user-role-icon--active={u.role === 'viewer'}
                    title="Viewer"
                    aria-label="Set viewer"
                    aria-pressed={u.role === 'viewer'}
                    on:click={() => onSetUserRole(u.id, 'viewer')}
                  >
                    V
                  </button>
                  <button
                    type="button"
                    class="user-role-icon"
                    class:user-role-icon--active={u.role === 'editor'}
                    title="Editor"
                    aria-label="Set editor"
                    aria-pressed={u.role === 'editor'}
                    on:click={() => onSetUserRole(u.id, 'editor')}
                  >
                    E
                  </button>
                  <button
                    type="button"
                    class="user-role-icon"
                    class:user-role-icon--active={u.role === 'admin'}
                    title="Admin"
                    aria-label="Set admin"
                    aria-pressed={u.role === 'admin'}
                    on:click={() => onSetUserRole(u.id, 'admin')}
                  >
                    A
                  </button>
                </div>
              </td>
              <td class="table-actions admin-users-actions">
                <button
                  type="button"
                  class="btn-icon-compact"
                  title="Edit name fields"
                  aria-label="Edit user profile"
                  on:click={() => onOpenEditUser(u)}
                >
                  <span class="btn-icon-compact__icon" aria-hidden="true">✎</span>
                </button>
                <button
                  type="button"
                  class="btn-icon-compact"
                  title="Send password reset email"
                  aria-label="Send password reset email"
                  on:click={() => onRequestPasswordReset(u.id)}
                >
                  <span class="btn-icon-compact__icon" aria-hidden="true">🔑</span>
                </button>
                <button
                  type="button"
                  class="danger btn-icon-compact"
                  title="Delete user"
                  aria-label="Delete user"
                  on:click={() => onOpenDeleteOne(u.id)}
                >
                  <span class="btn-icon-compact__icon" aria-hidden="true">🗑</span>
                </button>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  {#if usersTotal > 0}
    <ListPagination
      bind:listPage={usersPage}
      bind:listPageSize={usersPageSize}
      totalListPages={totalUserPages}
      visibleCount={usersTotal}
      {LIST_PAGE_SIZES}
    />
  {/if}
</section>

<style>
  .admin-users-title {
    margin-top: 0;
  }
  .admin-users-lead {
    margin-top: 0;
    max-width: 48rem;
  }
  .admin-users-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  .admin-users-search {
    flex: 1 1 12rem;
    min-width: 0;
  }
  .admin-users-search input {
    width: 100%;
    box-sizing: border-box;
  }
  .admin-users-filters {
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
  }
  .admin-users-bulk {
    margin-bottom: 0.5rem;
  }
  .user-role-icon-group {
    display: inline-flex;
    gap: 0.2rem;
  }
  .user-role-icon {
    min-width: 1.75rem;
    height: 1.75rem;
    padding: 0 0.35rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    color: var(--color-text);
  }
  .user-role-icon--active {
    background: var(--color-accent-soft);
    border-color: var(--color-accent, #1d70b8);
  }
  .admin-users-actions {
    white-space: nowrap;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
