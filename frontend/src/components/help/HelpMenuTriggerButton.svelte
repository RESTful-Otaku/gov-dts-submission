<script lang="ts">
  export let menuOpen = false
  export let onToggleMenu: () => void
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
  aria-label={menuOpen ? 'Close menu' : 'Open menu'}
  title={menuOpen ? 'Close menu' : 'Open menu'}
>
  <span class="btn-help-bars" aria-hidden="true">
    <span class="btn-help-bar btn-help-bar--top"></span>
    <span class="btn-help-bar btn-help-bar--bottom"></span>
  </span>
</button>
