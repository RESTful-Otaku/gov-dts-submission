<script lang="ts">
  export let menuOpen = false
  export let onToggleMenu: () => void
  export let initials = ''
  /** When true, sits in the task toolbar row (flow layout); when false, header positions it (e.g. fixed on narrow). */
  export let inToolbar = false
</script>

<button
  type="button"
  class="btn-help"
  class:btn-help--in-toolbar={inToolbar}
  class:btn-help--open={menuOpen}
  on:click|preventDefault|stopPropagation={onToggleMenu}
  aria-expanded={menuOpen}
  aria-haspopup="dialog"
  aria-label={menuOpen ? 'Close profile menu' : 'Open profile menu'}
  title={menuOpen ? 'Close profile menu' : 'Open profile menu'}
>
  {#if initials.trim()}
    <span class="btn-help-avatar" aria-hidden="true">{initials.trim().slice(0, 2).toUpperCase()}</span>
  {:else}
    <span class="btn-help-avatar" aria-hidden="true">◯</span>
  {/if}
</button>
