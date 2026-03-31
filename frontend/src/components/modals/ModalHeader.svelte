<script lang="ts">
  export let titleId: string
  export let title: string
  export let onClose: () => void
  export let showClose = true
</script>

<div class="modal-header">
  <h2 id={titleId}>{title}</h2>
  {#if showClose}
    <button type="button" class="modal-close" aria-label="Close" on:click={onClose}>×</button>
  {/if}
</div>
