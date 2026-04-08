<script lang="ts">
  /** Matches {@link ViewModeToggle}: `view-toggle` + `btn-icon-compact` + `selected`. */
  export let mode: 'login' | 'register'
  export let onSetMode: (next: 'login' | 'register') => void
</script>

<div class="view-toggle auth-mode-toggle" role="tablist" aria-label="Sign-in mode">
  <button
    type="button"
    class="btn-icon-compact"
    class:selected={mode === 'login'}
    on:click={() => onSetMode('login')}
    title="Log in"
    aria-label="Log in"
    aria-selected={mode === 'login'}
    role="tab"
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">→</span>
    <span class="btn-icon-compact__label">Login</span>
  </button>
  <button
    type="button"
    class="btn-icon-compact"
    class:selected={mode === 'register'}
    on:click={() => onSetMode('register')}
    title="Create an account"
    aria-label="Register"
    aria-selected={mode === 'register'}
    role="tab"
  >
    <span class="btn-icon-compact__icon" aria-hidden="true">＋</span>
    <span class="btn-icon-compact__label">Register</span>
  </button>
</div>
