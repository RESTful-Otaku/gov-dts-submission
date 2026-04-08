<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'
  import FieldValidityIcon from './FieldValidityIcon.svelte'

  export let id: string
  export let label: string
  export let value = ''
  export let autocomplete: HTMLInputAttributes['autocomplete'] = 'current-password'
  export let invalid = false
  export let showPassword = false
  export let onToggleShow: () => void
  export let onBlur: () => void = () => {}
  export let validityBlurred = false
  export let validityValid = false
</script>

<div class="password-field">
  {#if label}
    <label class="password-field__label" for={id}>{label}</label>
  {/if}
  <div class="password-field__row" class:input-invalid={invalid}>
    <div class="password-field__input-cell">
      <input
        {id}
        type={showPassword ? 'text' : 'password'}
        class="password-field__input"
        class:password-field__input--validity-pad={validityBlurred}
        {autocomplete}
        bind:value
        on:blur={onBlur}
      />
      {#if validityBlurred}
        <span class="password-field__validity-slot" aria-hidden="true">
          <FieldValidityIcon inline blurred={true} valid={validityValid} />
        </span>
      {/if}
    </div>
    <button
      type="button"
      class="password-field__eye"
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      title={showPassword ? 'Hide password' : 'Show password'}
      on:click={onToggleShow}
    >
      {#if showPassword}
        <svg class="password-field__eye-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
          />
        </svg>
      {:else}
        <svg class="password-field__eye-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10 .99 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"
          />
        </svg>
      {/if}
    </button>
  </div>
</div>

<style>
  .password-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .password-field__label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-muted);
  }

  .password-field__row {
    display: flex;
    align-items: stretch;
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    overflow: hidden;
    background: var(--color-surface, #fff);
  }

  .password-field__input-cell {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .password-field__row.input-invalid {
    border-color: #b91c1c;
  }

  .password-field__input {
    flex: 1;
    min-width: 0;
    width: 100%;
    border: none;
    padding: 0.5rem 0.6rem;
    font: inherit;
    background: transparent;
    box-sizing: border-box;
  }

  .password-field__input--validity-pad {
    padding-right: 2rem;
  }

  .password-field__validity-slot {
    position: absolute;
    right: 0.4rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .password-field__input:focus {
    outline: none;
  }

  .password-field__eye {
    flex: 0 0 auto;
    width: 2.5rem;
    border: none;
    border-left: 1px solid var(--color-border);
    background: var(--color-surface-muted, rgba(0, 0, 0, 0.04));
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0;
  }

  .password-field__eye:hover {
    background: var(--color-border-soft, rgba(0, 0, 0, 0.06));
  }

  .password-field__eye-svg {
    width: 1.25rem;
    height: 1.25rem;
    display: block;
    margin: 0 auto;
    opacity: 0.75;
  }
</style>
