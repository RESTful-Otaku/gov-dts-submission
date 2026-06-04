<script lang="ts">
  export let healthStatus: 'ok' | 'degraded' | 'down' | 'unknown'
  export let healthMessage = ''
  export let refreshHealth: () => void
</script>

<div
  class="health-banner"
  role="status"
  aria-live="polite"
>
  <span class="health-indicator health-indicator--{healthStatus}"></span>
  <div class="health-text">
    <strong>
      {healthStatus === 'down'
        ? 'The service is currently unavailable.'
        : 'The service may be experiencing issues.'}
    </strong>
    {#if healthMessage}
      <span class="health-message">{healthMessage}</span>
    {/if}
  </div>
  <button
    type="button"
    class="health-refresh"
    on:click={refreshHealth}
  >
    Retry
  </button>
</div>

