<script lang="ts" context="module">
  export type { Toast, ToastType } from '../../lib/app/types'
</script>

<script lang="ts">
  import { UI_COPY } from '../../lib/app/copy'
  import type { Toast } from '../../lib/app/types'

  export let toasts: Toast[] = []
  export let dismissToast: (id: number) => void
</script>

<div
  class="toast-container"
  role="region"
  aria-label={UI_COPY.common.notifications}
>
  {#each toasts as toast (toast.id)}
    <div
      class="toast toast--{toast.type}"
      class:toast--exiting={toast.exiting}
      role="alert"
      data-toast-id={toast.id}
    >
      <span class="toast-message">{toast.message}</span>
      {#if typeof toast.countdownSeconds === 'number'}
        <span class="toast-countdown" aria-live="polite">{toast.countdownSeconds}</span>
      {/if}
      {#if toast.actionLabel && toast.onAction}
        <button
          type="button"
          class="toast-action"
          on:click={toast.onAction}
        >
          {toast.actionLabel}
        </button>
      {/if}
      <button
        type="button"
        class="toast-close"
        aria-label={UI_COPY.common.dismiss}
        on:click={() => dismissToast(toast.id)}
      >
        ×
      </button>
    </div>
  {/each}
</div>
