<script lang="ts">
  /** Single labeled `<select>` for filter panels (shared `control-label` + styling). */
  export let label: string
  export let ariaLabel: string
  export let value: string
  export let options: readonly { value: string; label: string }[]
  /** Fires after the user picks an option (value is the new selection). */
  export let onSelect: ((next: string) => void) | undefined = undefined
</script>

<label>
  <span class="control-label">{label}</span>
  <select
    bind:value
    aria-label={ariaLabel}
    on:change={(e) => onSelect?.((e.currentTarget as HTMLSelectElement).value)}
  >
    {#each options as opt}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</label>
