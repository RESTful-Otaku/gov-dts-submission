<script lang="ts" context="module">
  export type { Toast, ToastType } from '../../lib/app/types'
</script>

<script lang="ts">
  import type { Toast } from '../../lib/app/types'

  export let toasts: Toast[] = []
  export let dismissToast: (id: number) => void
</script>

<div
  class="toast-container"
  role="region"
  aria-label="Notifications"
>
  {#each toasts as toast (toast.id)}
    <div
      class="toast toast--{toast.type}"
      class:toast--exiting={toast.exiting}
      role="alert"
      data-toast-id={toast.id}
    >
      <span class="toast-message">{toast.message}</span>
      <button
        type="button"
        class="toast-close"
        aria-label="Dismiss"
        on:click={() => dismissToast(toast.id)}
      >
        ×
      </button>
    </div>
  {/each}
</div>
