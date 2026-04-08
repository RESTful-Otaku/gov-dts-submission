<script lang="ts">
  import type { AuditLog, AuditLogsSortField, AuthUser } from '../../lib/api'
  import { UI_COPY } from '../../lib/app/copy'
  import { tableSortGlyph } from '../../lib/ui/tableSortGlyph'

  export let users: AuthUser[] = []
  export let auditLogs: AuditLog[] = []
  export let auditUserId = ''
  export let auditQuery = ''
  /** Server-side filter: JSON field name in changed_fields (e.g. title, dueAt) */
  export let auditChangedField = ''
  export let auditSort: AuditLogsSortField = 'created_at'
  export let auditOrder: 'asc' | 'desc' = 'desc'
  export let onSetAuditUserId: (value: string) => void
  export let onSetAuditQuery: (value: string) => void
  export let onSetAuditChangedField: (value: string) => void
  export let onToggleAuditSort: (field: AuditLogsSortField) => void
  export let onClearAuditFilters: () => void
  export let onRefresh: () => void

  let expanded: Record<string, boolean> = {}

  function toggleRow(id: string): void {
    expanded = { ...expanded, [id]: !expanded[id] }
  }

  function actionLabel(action: string): string {
    const a = action.toLowerCase()
    if (a === 'create') return 'Created'
    if (a === 'delete') return 'Deleted'
    if (a === 'edit') return 'Edited'
    return action
  }

  $: hasAuditFilters = !!(auditUserId || auditQuery.trim() || auditChangedField)

  function actionBadgeClass(action: string): string {
    const a = action.toLowerCase()
    if (a === 'create') return 'audit-action-badge audit-action-badge--create'
    if (a === 'delete') return 'audit-action-badge audit-action-badge--delete'
    if (a === 'edit') return 'audit-action-badge audit-action-badge--edit'
    return 'audit-action-badge audit-action-badge--muted'
  }
</script>

<section class="card audit-logs-card" data-tour="admin-audit-panel">
  <h2 style="margin-top:0">Audit Logs</h2>
  <div class="audit-logs-toolbar">
    <label class="audit-logs-field">
      <span class="audit-logs-field__label">User</span>
      <select value={auditUserId} on:change={(e) => onSetAuditUserId((e.currentTarget as HTMLSelectElement).value)}>
        <option value="">All users</option>
        {#each users as u (u.id)}
          <option value={u.id}>{u.username} — {u.role}</option>
        {/each}
      </select>
    </label>
    <label class="audit-logs-field audit-logs-field--grow">
      <span class="audit-logs-field__label">Search</span>
      <input
        type="search"
        placeholder="Display name, action, JSON, changed fields…"
        value={auditQuery}
        on:input={(e) => onSetAuditQuery((e.currentTarget as HTMLInputElement).value)}
      />
    </label>
    <button type="button" class="btn-secondary" on:click={onRefresh}>Refresh</button>
    {#if hasAuditFilters}
      <button type="button" class="btn-clear-filters btn-icon-compact audit-logs-clear" on:click={onClearAuditFilters}>
        <span class="btn-icon-compact__icon" aria-hidden="true">⌫</span>
        <span class="btn-icon-compact__label">{UI_COPY.tasks.clearFilters}</span>
      </button>
    {/if}
  </div>

  {#if auditChangedField}
    <p class="audit-logs-active-field muted">
      Filtering by field <strong>{auditChangedField}</strong> — click a field tag below or clear filters to show all.
    </p>
  {/if}

  <div class="list-wrapper" role="region" aria-label="Audit logs table">
    <table class="task-table audit-table">
      <thead>
        <tr>
          <th
            scope="col"
            aria-sort={auditSort === 'created_at' ? (auditOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <button type="button" class="th-sort" on:click={() => onToggleAuditSort('created_at')}>
              Timestamp{' '}
              <span class="th-sort__glyph" aria-hidden="true"
                >{tableSortGlyph(auditSort === 'created_at', auditOrder === 'asc')}</span
              >
            </button>
          </th>
          <th
            scope="col"
            aria-sort={auditSort === 'username' ? (auditOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <button type="button" class="th-sort" on:click={() => onToggleAuditSort('username')}>
              Display name{' '}
              <span class="th-sort__glyph" aria-hidden="true"
                >{tableSortGlyph(auditSort === 'username', auditOrder === 'asc')}</span
              >
            </button>
          </th>
          <th
            scope="col"
            aria-sort={auditSort === 'action' ? (auditOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <button type="button" class="th-sort" on:click={() => onToggleAuditSort('action')}>
              Action{' '}
              <span class="th-sort__glyph" aria-hidden="true"
                >{tableSortGlyph(auditSort === 'action', auditOrder === 'asc')}</span
              >
            </button>
          </th>
          <th
            scope="col"
            aria-sort={auditSort === 'changed_fields' ? (auditOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
          >
            <button type="button" class="th-sort" on:click={() => onToggleAuditSort('changed_fields')}>
              Changed fields{' '}
              <span class="th-sort__glyph" aria-hidden="true"
                >{tableSortGlyph(auditSort === 'changed_fields', auditOrder === 'asc')}</span
              >
            </button>
          </th>
          <th scope="col">Raw data</th>
        </tr>
      </thead>
      <tbody>
        {#if auditLogs.length === 0}
          <tr><td colspan="5" class="empty-cell">No audit logs found.</td></tr>
        {:else}
          {#each auditLogs as log (log.id)}
            <tr>
              <td>{new Date(log.createdAt).toLocaleString()}</td>
              <td>{log.username}</td>
              <td>
                <span class={actionBadgeClass(log.action)}>{actionLabel(log.action)}</span>
              </td>
              <td>
                {#if log.changedFields?.length}
                  <div class="tag-chips audit-field-chips" role="group" aria-label="Changed fields">
                    {#each log.changedFields as field (field)}
                      <button
                        type="button"
                        class="tag-chip audit-field-chip"
                        class:audit-field-chip--active={auditChangedField === field}
                        on:click={() => onSetAuditChangedField(field)}
                        title="Show logs that include this field"
                      >
                        {field}
                      </button>
                    {/each}
                  </div>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td>
                <button type="button" class="btn-secondary" on:click={() => toggleRow(log.id)}>
                  {expanded[log.id] ? 'Hide' : 'Expand'}
                </button>
              </td>
            </tr>
            {#if expanded[log.id]}
              <tr class="audit-logs-raw-row">
                <td colspan="5">
                  <pre class="audit-logs-pre">{log.rawJson}</pre>
                </td>
              </tr>
            {/if}
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</section>

<style>
  .audit-logs-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: flex-end;
    margin-bottom: 0.75rem;
  }

  .audit-logs-field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  .audit-logs-field__label {
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .audit-logs-field--grow {
    flex: 1 1 200px;
    min-width: 160px;
  }

  .audit-logs-field input,
  .audit-logs-field select {
    min-width: 0;
  }

  .audit-logs-clear {
    margin-left: auto;
  }

  .audit-logs-active-field {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
  }

  .audit-table .audit-action-badge {
    display: inline-block;
    padding: 0.15rem 0.55rem;
    font-size: 0.7rem;
    border-radius: 4px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .audit-action-badge--create {
    background-color: rgba(22, 163, 74, 0.18);
    color: #166534;
  }

  .audit-action-badge--edit {
    background-color: rgba(161, 98, 7, 0.25);
    color: #854d0e;
  }

  .audit-action-badge--delete {
    background-color: rgba(220, 38, 38, 0.16);
    color: #b91c1c;
  }

  .audit-action-badge--muted {
    background-color: rgba(100, 116, 139, 0.18);
    color: var(--color-muted, #64748b);
    border: 1px solid var(--color-border, rgba(100, 116, 139, 0.35));
  }

  .audit-field-chips {
    margin: 0;
  }

  button.audit-field-chip.audit-field-chip--active {
    background-color: var(--color-accent-soft);
    color: var(--color-accent);
    border: 1px solid var(--color-accent);
  }

  .audit-logs-pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.8rem;
    max-height: 40vh;
    overflow: auto;
  }
</style>
