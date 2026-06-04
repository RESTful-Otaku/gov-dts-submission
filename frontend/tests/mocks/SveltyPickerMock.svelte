<script lang="ts">
  // Minimal mock for `svelty-picker` for jsdom tests.
  // It behaves like a plain <input> with bind:value support.

  export let value: string = ''
  export let inputId: string | undefined
  export let placeholder: string | undefined
  export let required: boolean | undefined

  // Used throughout the app for styling; keep in DOM for tests.
  export let inputClasses: string | undefined
</script>

<input
  id={inputId}
  class={inputClasses}
  {placeholder}
  {required}
  bind:value
/>

