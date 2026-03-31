<script lang="ts">
  import govLogo from '../../../assets/gov_uk.webp'

  export let menuOpen = false
  export let onToggleMenu: () => void
  /** When true (e.g. mobile expanded search), header is visually hidden; keep SR in sync. */
  export let ariaHidden = false
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
    <button
      type="button"
      class="btn-help"
      class:btn-help--open={menuOpen}
      on:click={onToggleMenu}
      aria-expanded={menuOpen}
      aria-haspopup="dialog"
      aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      title={menuOpen ? 'Close menu' : 'Open menu'}
    >
      <span class="btn-help-bars" aria-hidden="true">
        <span class="btn-help-bar btn-help-bar--top"></span>
        <span class="btn-help-bar btn-help-bar--bottom"></span>
      </span>
    </button>
    </div>
  </div>
</header>

