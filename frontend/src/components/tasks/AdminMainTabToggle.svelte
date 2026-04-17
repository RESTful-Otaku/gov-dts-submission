<script lang="ts">
  /** Matches {@link ViewModeToggle} styling: view-toggle + btn-icon-compact + selected state. */
  export let activeMainTab: 'tasks' | 'users' | 'audit'
  export let onSetMainTab: (tab: 'users' | 'audit') => void
</script>

<div class="view-toggle admin-main-toggle" data-tour="admin-main-tab" role="tablist" aria-label="Admin sections">
  <button
    type="button"
    class="btn-icon-compact"
    class:selected={activeMainTab === 'users'}
    on:click={() => onSetMainTab('users')}
    title="Users"
    aria-label="Users"
    aria-selected={activeMainTab === 'users'}
    role="tab"
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">☷</span>
    <span class="btn-icon-compact__label">Users</span>
  </button>
  <button
    type="button"
    class="btn-icon-compact"
    class:selected={activeMainTab === 'audit'}
    on:click={() => onSetMainTab('audit')}
    title="Audit"
    aria-label="Audit"
    aria-selected={activeMainTab === 'audit'}
    role="tab"
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">≡</span>
    <span class="btn-icon-compact__label">Audit</span>
  </button>
</div>
