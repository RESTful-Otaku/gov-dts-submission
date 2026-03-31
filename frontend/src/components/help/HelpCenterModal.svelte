<script lang="ts">
  import { fade } from 'svelte/transition'
  import type { OnboardingStepId } from '../../lib/app/onboarding/types'
  import type { HelpTabId } from '../../lib/app/onboarding/types'
  import type { TourStepDef } from '../../lib/app/onboarding/types'
  import type { MotionPreference, SortKey, StartupViewMode, UiDensity } from '../../lib/app/types'
  import { CHECKLIST_META } from '../../lib/app/onboarding/definitions'
  import { APP_VERSION } from '../../lib/app/appVersion'
  import { helpModalContentTransition } from '../../lib/ui/modalContentTransition'
  import ModalHeader from '../modals/ModalHeader.svelte'

  export let isNarrow: boolean

  export let helpActiveTab: HelpTabId
  export let tourSteps: TourStepDef[]
  export let checklist: Record<OnboardingStepId, boolean>
  export let checklistDone: number
  export let checklistTotal: number
  export let theme: 'light' | 'dark'
  export let fontSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
  export let density: UiDensity
  export let motionPreference: MotionPreference
  export let startupViewMode: StartupViewMode
  export let defaultSortKey: SortKey
  export let defaultSortAscending: boolean

  export let closeHelp: () => void
  export let setHelpTab: (t: HelpTabId) => void
  export let setTheme: (next: 'light' | 'dark') => void
  export let setFontSize: (next: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl') => void
  export let setDensity: (next: UiDensity) => void
  export let setMotionPreference: (next: MotionPreference) => void
  export let setStartupViewMode: (next: StartupViewMode) => void
  export let setDefaultSort: (sortKey: SortKey, sortAscending: boolean) => void
  export let restoreDefaultSettings: () => void

  const FONT_SIZE_STEPS: Array<{ value: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'; label: string }> = [
    { value: 'xs', label: 'XS' },
    { value: 'sm', label: 'S' },
    { value: 'md', label: 'M' },
    { value: 'lg', label: 'L' },
    { value: 'xl', label: 'XL' },
    { value: 'xxl', label: 'XXL' },
  ]

  $: fontSizeIndex = Math.max(
    0,
    FONT_SIZE_STEPS.findIndex((s) => s.value === fontSize),
  )
  export let startGuidedTour: () => void
  export let skipWelcomeForever: () => void
  export let replayTourFromStep: (id: OnboardingStepId) => void
  export let resetOnboardingProgress: () => void

  export let handleModalBackdropClick: (e: MouseEvent) => void

  $: progressPct = checklistTotal > 0 ? Math.round((100 * checklistDone) / checklistTotal) : 0
  $: checklistRows = CHECKLIST_META.filter((m) => !isNarrow || m.id !== 'view_modes')
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="modal-backdrop modal-backdrop--help"
  role="dialog"
  aria-modal="true"
  aria-labelledby="help-modal-title"
  tabindex="-1"
  on:click={handleModalBackdropClick}
  on:keydown={(e) => e.key === 'Escape' && closeHelp()}
  transition:fade={{ duration: 200 }}
>
  <button
    type="button"
    class="btn-help btn-help--open help-menu-fab"
    on:click={closeHelp}
    aria-label="Close menu"
    title="Close menu"
  >
    <span class="btn-help-bars" aria-hidden="true">
      <span class="btn-help-bar btn-help-bar--top"></span>
      <span class="btn-help-bar btn-help-bar--bottom"></span>
    </span>
  </button>

  <div
    class="modal modal--help"
    role="document"
    on:keydown={(e) => e.key === 'Escape' && closeHelp()}
    transition:helpModalContentTransition={{ isNarrow }}
  >
    <ModalHeader titleId="help-modal-title" title="Help &amp; guided tour" onClose={closeHelp} showClose={false} />

    <ul class="help-modal-tabs" role="tablist" aria-label="Help sections">
      <li role="none">
        <button
          type="button"
          role="tab"
          class:is-active={helpActiveTab === 'settings'}
          aria-selected={helpActiveTab === 'settings'}
          on:click={() => setHelpTab('settings')}
        >
          Settings
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          role="tab"
          class:is-active={helpActiveTab === 'guide'}
          aria-selected={helpActiveTab === 'guide'}
          on:click={() => setHelpTab('guide')}
        >
          Guide
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          role="tab"
          class:is-active={helpActiveTab === 'checklist'}
          aria-selected={helpActiveTab === 'checklist'}
          on:click={() => setHelpTab('checklist')}
        >
          Checklist
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          role="tab"
          class:is-active={helpActiveTab === 'sections'}
          aria-selected={helpActiveTab === 'sections'}
          on:click={() => setHelpTab('sections')}
        >
          Sections
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          role="tab"
          class:is-active={helpActiveTab === 'about'}
          aria-selected={helpActiveTab === 'about'}
          on:click={() => setHelpTab('about')}
        >
          About
        </button>
      </li>
    </ul>

    <div class="help-modal-body" role="tabpanel">
      {#if helpActiveTab === 'guide'}
        <h2 class="modal-task-title" style="margin-top:0">Welcome to the task manager</h2>
        <p>
          The <strong>guided tour</strong> uses on-screen hints next to each control (not a blocking popup), so you can
          tap and try things right away. The screen outside the current step is blurred until you finish or exit the
          tour.
        </p>
        <p>
          Progress is saved on this device. Open this panel any time with the <strong>menu</strong> button in the
          header.
        </p>
        <div class="help-welcome-actions">
          <button type="button" on:click={startGuidedTour}>Start guided tour</button>
          <button type="button" class="secondary" on:click={skipWelcomeForever}>Skip — don’t show on startup</button>
        </div>
      {:else if helpActiveTab === 'checklist'}
        <div class="help-progress-wrap">
          <div class="help-progress-track" aria-hidden="true">
            <div class="help-progress-fill" style={`width: ${progressPct}%`}></div>
          </div>
          <p class="help-progress-label">{checklistDone} of {checklistTotal} activities completed</p>
        </div>
        <ul class="help-checklist">
          {#each checklistRows as row (row.id)}
            <li class:is-done={checklist[row.id]}>
              <span class="help-check-icon" aria-hidden="true">{checklist[row.id] ? '✓' : ''}</span>
              <div class="help-check-text">
                <strong>{row.label}</strong>
                <span>{row.hint}</span>
              </div>
            </li>
          {/each}
        </ul>
        <div class="help-tour-actions">
          <button type="button" class="secondary" on:click={resetOnboardingProgress}>Reset progress</button>
        </div>
      {:else if helpActiveTab === 'sections'}
        <p class="help-progress-label">Replay any section. The tour runs in coach mode next to the real controls.</p>
        <div class="help-sections-grid">
          {#each tourSteps.filter((s) => s.id !== 'welcome') as s (s.id)}
            <div class="help-section-row">
              <span>{s.title}</span>
              <button type="button" on:click={() => replayTourFromStep(s.id)}>Open</button>
            </div>
          {/each}
        </div>
      {:else if helpActiveTab === 'settings'}
        <div class="help-settings-grid">
          <section class="help-settings-card" data-tour="theme">
            <h3>Theme</h3>
            <p>Switch between light and dark mode for comfortable reading.</p>
            <button
              type="button"
              class={`theme-toggle-switch ${theme === 'dark' ? 'is-dark' : 'is-light'}`}
              on:click={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              <span class="theme-toggle-track">
                <span class="theme-toggle-thumb"></span>
              </span>
              <span class="theme-toggle-icons" aria-hidden="true">
                <span class="theme-icon theme-icon--day"></span>
                <span class="theme-icon theme-icon--night"></span>
              </span>
            </button>
          </section>
          <section class="help-settings-card" data-tour="text-size">
            <h3>Text size</h3>
            <p>Choose one of six text scales with quick visual steps.</p>
            <div class="font-size-slider-wrap">
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={fontSizeIndex}
                aria-label="Text size scale"
                aria-valuemin={0}
                aria-valuemax={5}
                aria-valuenow={fontSizeIndex}
                aria-valuetext={`Step ${fontSizeIndex + 1} of 6 (${FONT_SIZE_STEPS[fontSizeIndex]?.label ?? 'M'})`}
                on:input={(e) => setFontSize(FONT_SIZE_STEPS[Number((e.currentTarget as HTMLInputElement).value)]?.value ?? 'md')}
              />
              <div class="font-size-aa-previews" aria-hidden="true">
                {#each FONT_SIZE_STEPS as step}
                  <span
                    class={`font-size-aa-preview font-size-aa-preview--${step.value}`}
                    class:is-selected={fontSize === step.value}
                  >Aa</span>
                {/each}
              </div>
            </div>
          </section>
          <section class="help-settings-card" data-tour="density">
            <h3>Density</h3>
            <p>Use compact spacing to fit more content on small screens or web dashboards.</p>
            <div class="font-size-buttons" role="group" aria-label="Density options">
              <button
                type="button"
                class="font-btn"
                class:selected={density === 'comfortable'}
                aria-pressed={density === 'comfortable'}
                on:click={() => setDensity('comfortable')}
              >
                Comfortable
              </button>
              <button
                type="button"
                class="font-btn"
                class:selected={density === 'compact'}
                aria-pressed={density === 'compact'}
                on:click={() => setDensity('compact')}
              >
                Compact
              </button>
            </div>
          </section>
          <section class="help-settings-card" data-tour="motion">
            <h3>Motion</h3>
            <p>Reduce animation to improve accessibility, comfort, and battery usage.</p>
            <div class="font-size-buttons" role="group" aria-label="Motion options">
              <button
                type="button"
                class="font-btn"
                class:selected={motionPreference === 'system'}
                aria-pressed={motionPreference === 'system'}
                on:click={() => setMotionPreference('system')}
              >
                System
              </button>
              <button
                type="button"
                class="font-btn"
                class:selected={motionPreference === 'reduced'}
                aria-pressed={motionPreference === 'reduced'}
                on:click={() => setMotionPreference('reduced')}
              >
                Reduced
              </button>
              <button
                type="button"
                class="font-btn"
                class:selected={motionPreference === 'full'}
                aria-pressed={motionPreference === 'full'}
                on:click={() => setMotionPreference('full')}
              >
                Full
              </button>
            </div>
          </section>
          <section class="help-settings-card" data-tour="startup-view">
            <h3>Startup view</h3>
            <p>Choose which view opens first, or remember your most recent view.</p>
            <label class="control-stack">
              <span>Open app in</span>
              <select
                value={startupViewMode}
                on:change={(e) => setStartupViewMode((e.currentTarget as HTMLSelectElement).value as StartupViewMode)}
              >
                <option value="remember">Remember last used</option>
                <option value="cards">Cards</option>
                <option value="list">List</option>
                <option value="kanban">Kanban</option>
              </select>
            </label>
          </section>
          <section class="help-settings-card">
            <h3>Default sort</h3>
            <p>Set the default sort for tasks when the app opens.</p>
            <div class="help-settings-grid help-settings-grid--nested">
              <label class="control-stack">
                <span>Sort by</span>
                <select
                  value={defaultSortKey}
                  on:change={(e) =>
                    setDefaultSort((e.currentTarget as HTMLSelectElement).value as SortKey, defaultSortAscending)}
                >
                  <option value="due">Due date</option>
                  <option value="title">Title</option>
                  <option value="priority">Priority</option>
                </select>
              </label>
              <label class="control-stack">
                <span>Direction</span>
                <select
                  value={defaultSortAscending ? 'asc' : 'desc'}
                  on:change={(e) =>
                    setDefaultSort(defaultSortKey, (e.currentTarget as HTMLSelectElement).value === 'asc')}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
            </div>
          </section>
          <section class="help-settings-card" data-tour="restore-defaults">
            <h3>Restore defaults</h3>
            <p>Reset all settings in this panel to recommended defaults.</p>
            <button type="button" class="secondary" on:click={restoreDefaultSettings}>Restore defaults</button>
          </section>
        </div>
      {:else}
        <div class="help-about">
          <p class="help-about-version" aria-label="Application version">Version {APP_VERSION}</p>
          <h3>About this app</h3>
          <p>
            Caseworker task manager is a demonstration app for capturing, prioritising, and tracking tasks with due
            dates, tags, and multiple views (summary cards, list, and kanban on larger screens). Web and mobile
            clients talk to a Go API backed by SQLite, PostgreSQL, MariaDB, or MongoDB.
          </p>
          <h3>Digital Talent Scheme</h3>
          <p>
            The brief and spirit of this build come from the UK Ministry of Justice
            <a
              href="https://github.com/hmcts/dts-developer-challenge"
              target="_blank"
              rel="noopener noreferrer"
            >Digital Talent Scheme developer challenge</a>
            — an open technical exercise for a caseworker task system. HMCTS publishes the specification on GitHub for
            transparency and for candidates learning in the open.
          </p>
          <h3>Developer</h3>
          <p>
            Built and maintained by
            <a href="https://github.com/RESTful-Otaku" target="_blank" rel="noopener noreferrer">RESTful-Otaku</a>.
            Source for this submission:
            <a
              href="https://github.com/RESTful-Otaku/gov-dts-submission"
              target="_blank"
              rel="noopener noreferrer"
            >gov-dts-submission</a>
            on GitHub.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>
