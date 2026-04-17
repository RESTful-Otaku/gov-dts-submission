<script lang="ts">
  import govLogo from '../../../assets/gov_uk.webp'
  import { UI_COPY } from '../../lib/app/copy'
  import HelpMenuTriggerButton from '../help/HelpMenuTriggerButton.svelte'

  export let menuOpen = false
  export let onToggleMenu: () => void
  /** When true (e.g. mobile expanded search), header is visually hidden; keep SR in sync. */
  export let ariaHidden = false
  /** When true, menu control lives in the task toolbar (collapsed chrome). */
  export let hideMenuButton = false
  export let menuInitials = ''
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
        <h1>{UI_COPY.header.appTitle}</h1>
        <p>{UI_COPY.header.appSubtitle}</p>
      </div>
    </div>
    {#if !hideMenuButton}
      <HelpMenuTriggerButton {menuOpen} {onToggleMenu} initials={menuInitials} />
    {/if}
    </div>
  </div>
</header>

