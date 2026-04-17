<script lang="ts">
  /** After blur: show green tick when valid, red cross when invalid. */
  export let blurred = false
  export let valid: boolean
  /** Use inside a relatively positioned input wrapper (right-aligned). */
  export let inline = false
</script>

{#if blurred}
  {#if valid}
    <span
      class="field-validity field-validity--ok"
      class:field-validity--inline={inline}
      aria-hidden="true"
      title="Looks good">✓</span>
  {:else}
    <span
      class="field-validity field-validity--bad"
      class:field-validity--inline={inline}
      aria-hidden="true"
      title="Please fix">✕</span>
  {/if}
{/if}

<style>
  .field-validity {
    flex: 0 0 auto;
    width: 1.35rem;
    height: 1.35rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 700;
    line-height: 1;
    margin-inline-start: 0.35rem;
  }

  .field-validity--ok {
    color: #166534;
    background: rgba(22, 163, 74, 0.2);
  }

  .field-validity--bad {
    color: #b91c1c;
    background: rgba(220, 38, 38, 0.15);
  }

  .field-validity--inline {
    margin-inline-start: 0;
    width: 1.25rem;
    height: 1.25rem;
    font-size: 0.68rem;
  }
</style>
