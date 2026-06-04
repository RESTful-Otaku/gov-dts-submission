<script lang="ts">
  /** Search input with icon. Use `mobileInline` + `expandedMobile` for narrow toolbar states. */
  export let searchTerm: string
  export let searchInput: HTMLInputElement | null = null
  export let placeholder: string
  export let title: string
  /** Desktop / wide layout: full-width in controls row. */
  export let expandedMobile = false
  /** Narrow toolbar: compact field in the row (not focused). */
  export let mobileInline = false
  export let onInput: (value: string) => void
  export let onBlur: (() => void) | undefined = undefined
  export let onFocus: (() => void) | undefined = undefined
</script>

<div
  class="search-wrapper"
  data-tour="search"
  class:search-wrapper--expanded={expandedMobile}
  class:search-wrapper--fullwidth={expandedMobile}
  class:search-wrapper--mobile-inline={mobileInline}
  class:search-wrapper--mobile-expanded={expandedMobile}
>
  <span class="search-icon" aria-hidden="true"></span>
  <input
    bind:this={searchInput}
    type="search"
    class="search-input"
    class:search-input--mobile-inline={mobileInline && !expandedMobile}
    class:search-input--mobile-expanded={expandedMobile}
    {placeholder}
    value={searchTerm}
    {title}
    on:input={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
    on:focus={() => onFocus?.()}
    on:blur={() => onBlur?.()}
  />
</div>
