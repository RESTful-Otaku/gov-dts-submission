<script lang="ts">
  import govLogo from '../../../assets/gov_uk.webp'
  import HelpMenuTriggerButton from '../help/HelpMenuTriggerButton.svelte'

  export let menuOpen = false
  export let onToggleMenu: () => void
  /** When true (e.g. mobile expanded search), header is visually hidden; keep SR in sync. */
  export let ariaHidden = false
  /** When true, menu control lives in the task toolbar (collapsed chrome). */
  export let hideMenuButton = false
</script>

<header class="app-header" aria-hidden={ariaHidden ? true : undefined}>
  <div class="app-header-main">
    <div class="app-header-top">
    <div class="app-header-brand">
      <div class="govuk-logo">
        <img src={govLogo} alt="GOV.UK" class="govuk-logo__crest" />
        <span class="govuk-logo__text"></span>
      </div>
      <div>
        <h1>Caseworker task manager</h1>
        <p>Capture, prioritise, and complete tasks.</p>
      </div>
    </div>
    {#if !hideMenuButton}
      <HelpMenuTriggerButton {menuOpen} {onToggleMenu} />
    {/if}
    </div>
  </div>
</header>

