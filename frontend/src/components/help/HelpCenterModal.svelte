<script lang="ts">
  import { fade } from 'svelte/transition'
  import { UI_COPY } from '../../lib/app/copy'
  import type { OnboardingStepId } from '../../lib/app/onboarding/types'
  import type { HelpTabId } from '../../lib/app/onboarding/types'
  import type { MotionPreference, SortKey, StartupViewMode, UiDensity } from '../../lib/app/types'
  import type { AuthUser } from '../../lib/api'
  import { CHECKLIST_META, checklistIdsForRoleAndLayout } from '../../lib/app/onboarding/definitions'
  import { APP_VERSION } from '../../lib/app/appVersion'
  import { adminContactMailtoHref } from '../../lib/app/constants'
  import { helpModalContentTransition } from '../../lib/ui/modalContentTransition'
  import ModalHeader from '../modals/ModalHeader.svelte'

  export let isNarrow: boolean

  export let helpActiveTab: HelpTabId
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
  export let currentUser: AuthUser | null
  export let authMode: 'login' | 'register'
  export let authEmail: string
  export let authFirstName: string
  export let authLastName: string
  export let authUsername: string
  export let authPassword: string
  export let authResetMode: 'none' | 'request' | 'confirm'
  export let authResetToken: string
  export let authNewPassword: string
  export let authErrors: Record<'email' | 'firstName' | 'lastName' | 'username' | 'password' | 'resetToken' | 'newPassword' | 'form', string>
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
  export let setAuthMode: (mode: 'login' | 'register') => void
  export let setAuthEmail: (value: string) => void
  export let setAuthFirstName: (value: string) => void
  export let setAuthLastName: (value: string) => void
  export let setAuthUsername: (value: string) => void
  export let setAuthPassword: (value: string) => void
  export let submitAuth: () => void
  export let requestPasswordRecovery: () => void
  export let submitPasswordReset: () => void
  export let signOut: () => void
  export let startOAuth: (provider: 'github' | 'google' | 'apple') => void
  export let setAuthResetMode: (mode: 'none' | 'request' | 'confirm') => void
  export let setAuthResetToken: (value: string) => void
  export let setAuthNewPassword: (value: string) => void

  export let handleModalBackdropClick: (e: MouseEvent) => void

  $: progressPct = checklistTotal > 0 ? Math.round((100 * checklistDone) / checklistTotal) : 0
  $: checklistRows = CHECKLIST_META.filter((m) =>
    checklistIdsForRoleAndLayout(isNarrow, currentUser?.role ?? null).includes(m.id),
  )
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
    aria-label={UI_COPY.help.closeMenu}
    title={UI_COPY.help.closeMenu}
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
    <ModalHeader titleId="help-modal-title" title={UI_COPY.help.title} onClose={closeHelp} showClose={false} />

    <ul class="help-modal-tabs" role="tablist" aria-label={UI_COPY.help.sectionsAria}>
      <li role="none">
        <button
          type="button"
          role="tab"
          class:is-active={helpActiveTab === 'profile'}
          aria-selected={helpActiveTab === 'profile'}
          on:click={() => setHelpTab('profile')}
        >
          {UI_COPY.help.tabs.profile}
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
          {UI_COPY.help.tabs.guide}
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
          {UI_COPY.help.tabs.checklist}
        </button>
      </li>
      <li role="none">
        <button
          type="button"
          role="tab"
          class:is-active={helpActiveTab === 'settings'}
          aria-selected={helpActiveTab === 'settings'}
          on:click={() => setHelpTab('settings')}
        >
          {UI_COPY.help.tabs.settings}
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
          {UI_COPY.help.tabs.about}
        </button>
      </li>
    </ul>

    <div class="help-modal-body" role="tabpanel">
      {#if helpActiveTab === 'profile'}
        {#if currentUser}
          <h2 class="modal-task-title" style="margin-top:0">Profile</h2>
          <p>Signed in as <strong>{currentUser.username}</strong> ({currentUser.role})</p>
          <p class="muted help-profile-admin">
            Request role or name changes from your team lead via
            <a href={adminContactMailtoHref()}>email the administrator</a>.
          </p>
          <button type="button" class="secondary" on:click={signOut}>Logout</button>
        {:else}
          <h2 class="modal-task-title" style="margin-top:0">Profile</h2>
          <div class="help-settings-grid">
            <label class="control-stack">
              <span>Mode</span>
              <select value={authMode} on:change={(e) => setAuthMode((e.currentTarget as HTMLSelectElement).value as 'login' | 'register')}>
                <option value="login">Login</option>
                <option value="register">Register</option>
              </select>
            </label>
            <label class="control-stack">
              <span>Email</span>
              <input class:input-invalid={Boolean(authErrors.email)} aria-invalid={Boolean(authErrors.email)} type="email" value={authEmail} on:input={(e) => setAuthEmail((e.currentTarget as HTMLInputElement).value)} />
              {#if authErrors.email}<small class="control-error">{authErrors.email}</small>{/if}
            </label>
            {#if authMode === 'register'}
              <label class="control-stack">
                <span>First name</span>
                <input class:input-invalid={Boolean(authErrors.firstName)} aria-invalid={Boolean(authErrors.firstName)} value={authFirstName} on:input={(e) => setAuthFirstName((e.currentTarget as HTMLInputElement).value)} />
                {#if authErrors.firstName}<small class="control-error">{authErrors.firstName}</small>{/if}
              </label>
              <label class="control-stack">
                <span>Last name</span>
                <input class:input-invalid={Boolean(authErrors.lastName)} aria-invalid={Boolean(authErrors.lastName)} value={authLastName} on:input={(e) => setAuthLastName((e.currentTarget as HTMLInputElement).value)} />
                {#if authErrors.lastName}<small class="control-error">{authErrors.lastName}</small>{/if}
              </label>
              <label class="control-stack">
                <span>Display name</span>
                <input
                  class:input-invalid={Boolean(authErrors.username)}
                  aria-invalid={Boolean(authErrors.username)}
                  aria-label="Display name"
                  value={authUsername}
                  on:input={(e) => setAuthUsername((e.currentTarget as HTMLInputElement).value)}
                />
                {#if authErrors.username}<small class="control-error">{authErrors.username}</small>{/if}
              </label>
            {/if}
            <label class="control-stack">
              <span>Password</span>
              <input class:input-invalid={Boolean(authErrors.password)} aria-invalid={Boolean(authErrors.password)} type="password" value={authPassword} on:input={(e) => setAuthPassword((e.currentTarget as HTMLInputElement).value)} />
              {#if authErrors.password}<small class="control-error">{authErrors.password}</small>{/if}
            </label>
            <div class="help-tour-actions">
              <button type="button" on:click={submitAuth}>{authMode === 'login' ? 'Login' : 'Create account'}</button>
              {#if authMode === 'login'}
                <button type="button" class="secondary" on:click={() => setAuthResetMode('request')}>Recover account</button>
              {/if}
            </div>
            {#if authResetMode === 'request'}
              <div class="help-tour-actions">
                <button type="button" class="secondary" on:click={requestPasswordRecovery}>Send reset link</button>
                <button type="button" class="secondary" on:click={() => setAuthResetMode('confirm')}>I have reset token</button>
              </div>
            {:else if authResetMode === 'confirm'}
              <label class="control-stack">
                <span>Recovery token</span>
                <input class:input-invalid={Boolean(authErrors.resetToken)} aria-invalid={Boolean(authErrors.resetToken)} value={authResetToken} on:input={(e) => setAuthResetToken((e.currentTarget as HTMLInputElement).value)} />
                {#if authErrors.resetToken}<small class="control-error">{authErrors.resetToken}</small>{/if}
              </label>
              <label class="control-stack">
                <span>New password</span>
                <input class:input-invalid={Boolean(authErrors.newPassword)} aria-invalid={Boolean(authErrors.newPassword)} type="password" value={authNewPassword} on:input={(e) => setAuthNewPassword((e.currentTarget as HTMLInputElement).value)} />
                {#if authErrors.newPassword}<small class="control-error">{authErrors.newPassword}</small>{/if}
              </label>
              <div class="help-tour-actions">
                <button type="button" on:click={submitPasswordReset}>Reset password</button>
                <button type="button" class="secondary" on:click={() => setAuthResetMode('none')}>Cancel</button>
              </div>
            {/if}
            <div class="help-tour-actions">
              <button type="button" class="secondary oauth-btn oauth-btn--github" on:click={() => startOAuth('github')}>
                <span class="oauth-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" focusable="false" aria-hidden="true">
                    <path fill="currentColor" d="M12 .5a12 12 0 0 0-3.79 23.39c.6.12.82-.26.82-.58v-2.1c-3.34.73-4.04-1.42-4.04-1.42-.55-1.38-1.34-1.75-1.34-1.75-1.1-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.08 1.84 2.83 1.31 3.52 1 .1-.78.42-1.31.76-1.62-2.66-.3-5.46-1.3-5.46-5.9 0-1.3.47-2.37 1.23-3.2-.12-.3-.53-1.53.12-3.18 0 0 1-.32 3.3 1.23a11.63 11.63 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.88.12 3.18.77.83 1.23 1.9 1.23 3.2 0 4.6-2.8 5.59-5.47 5.88.43.37.82 1.1.82 2.22v3.3c0 .32.22.7.82.58A12 12 0 0 0 12 .5Z"></path>
                  </svg>
                </span>
                GitHub
              </button>
              <button type="button" class="secondary oauth-btn oauth-btn--google" on:click={() => startOAuth('google')}>
                <span class="oauth-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" focusable="false" aria-hidden="true">
                    <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35a4.6 4.6 0 0 1-1.99 3.02v2.5h3.22c1.88-1.73 2.77-4.28 2.77-7.35 0-.68-.06-1.34-.18-1.98Z"></path>
                    <path fill="#34A853" d="M12 21c2.52 0 4.64-.83 6.18-2.25l-3.22-2.5c-.9.6-2.05.95-2.96.95-2.28 0-4.22-1.54-4.9-3.6H3.77v2.6A9.34 9.34 0 0 0 12 21Z"></path>
                    <path fill="#FBBC05" d="M7.1 13.6a5.6 5.6 0 0 1 0-3.2V7.8H3.77a9.34 9.34 0 0 0 0 8.4L7.1 13.6Z"></path>
                    <path fill="#EA4335" d="M12 6.8c1.37 0 2.6.47 3.56 1.38l2.66-2.67C16.64 4.06 14.52 3 12 3A9.34 9.34 0 0 0 3.77 7.8l3.33 2.6c.68-2.06 2.62-3.6 4.9-3.6Z"></path>
                  </svg>
                </span>
                Google
              </button>
              <button type="button" class="secondary oauth-btn oauth-btn--apple" on:click={() => startOAuth('apple')}>
                <span class="oauth-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14" focusable="false" aria-hidden="true">
                    <path fill="currentColor" d="M16.37 12.26c.02 2.34 2.05 3.12 2.08 3.13-.02.05-.32 1.1-1.06 2.18-.64.92-1.3 1.84-2.36 1.86-1.03.02-1.36-.6-2.54-.6-1.17 0-1.54.58-2.5.62-1 .04-1.76-.99-2.41-1.91-1.32-1.9-2.33-5.37-.97-7.75.67-1.18 1.86-1.92 3.16-1.94.99-.02 1.92.67 2.54.67.62 0 1.8-.83 3.03-.7.52.02 1.99.21 2.93 1.6-.08.05-1.75 1.02-1.73 2.84Zm-2-6.59c.53-.64.89-1.54.79-2.43-.76.03-1.69.5-2.23 1.13-.49.56-.92 1.47-.8 2.34.84.06 1.7-.43 2.24-1.04Z"></path>
                  </svg>
                </span>
                Apple
              </button>
            </div>
            {#if authErrors.form}<p class="control-error" role="alert">{authErrors.form}</p>{/if}
          </div>
        {/if}
      {:else if helpActiveTab === 'guide'}
        <h2 class="modal-task-title" style="margin-top:0">{UI_COPY.help.guideTitle}</h2>
        <p>
          {UI_COPY.help.guideBody1}
        </p>
        <p>
          {UI_COPY.help.guideBody2}
        </p>
        <div class="help-welcome-actions">
          <button type="button" on:click={startGuidedTour}>{UI_COPY.help.guideStart}</button>
          <button type="button" class="secondary" on:click={skipWelcomeForever}>{UI_COPY.help.guideSkip}</button>
        </div>
      {:else if helpActiveTab === 'checklist'}
        <div class="help-progress-wrap">
          <div class="help-progress-track" aria-hidden="true">
            <div class="help-progress-fill" style={`width: ${progressPct}%`}></div>
          </div>
          <p class="help-progress-label">{checklistDone} of {checklistTotal} {UI_COPY.help.checklistProgressSuffix}</p>
        </div>
        <ul class="help-checklist">
          {#each checklistRows as row (row.id)}
            <li class:is-done={checklist[row.id]}>
              <span class="help-check-icon" aria-hidden="true">{checklist[row.id] ? '✓' : ''}</span>
              <div class="help-check-text">
                <strong>{row.label}</strong>
                <span>{row.hint}</span>
              </div>
              <button type="button" class="secondary" on:click={() => replayTourFromStep(row.id)}>{UI_COPY.help.sectionsOpen}</button>
            </li>
          {/each}
        </ul>
        <div class="help-tour-actions">
          <button type="button" class="secondary" on:click={resetOnboardingProgress}>{UI_COPY.help.checklistReset}</button>
        </div>
      {:else if helpActiveTab === 'settings'}
        <div class="help-settings-grid">
          <section class="help-settings-card">
            <h3>{UI_COPY.help.settings.themeTitle}</h3>
            <p>{UI_COPY.help.settings.themeDesc}</p>
            <button
              type="button"
              class={`theme-toggle-switch ${theme === 'dark' ? 'is-dark' : 'is-light'}`}
              data-tour="help-settings-theme"
              on:click={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={theme === 'light' ? UI_COPY.help.settings.switchToDark : UI_COPY.help.settings.switchToLight}
              title={theme === 'light' ? UI_COPY.help.settings.switchToDark : UI_COPY.help.settings.switchToLight}
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
          <section class="help-settings-card" data-tour="help-settings-text-size">
            <h3>{UI_COPY.help.settings.textSizeTitle}</h3>
            <p>{UI_COPY.help.settings.textSizeDesc}</p>
            <div class="font-size-slider-wrap">
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                value={fontSizeIndex}
                aria-label={UI_COPY.help.settings.textSizeScaleAria}
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
          <section class="help-settings-card" data-tour="help-settings-density">
            <h3>{UI_COPY.help.settings.densityTitle}</h3>
            <p>{UI_COPY.help.settings.densityDesc}</p>
            <div class="font-size-buttons" role="group" aria-label={UI_COPY.help.settings.densityOptionsAria}>
              <button
                type="button"
                class="font-btn"
                class:selected={density === 'comfortable'}
                aria-pressed={density === 'comfortable'}
                on:click={() => setDensity('comfortable')}
              >
                {UI_COPY.help.settings.densityComfortable}
              </button>
              <button
                type="button"
                class="font-btn"
                class:selected={density === 'compact'}
                aria-pressed={density === 'compact'}
                on:click={() => setDensity('compact')}
              >
                {UI_COPY.help.settings.densityCompact}
              </button>
            </div>
          </section>
          <section class="help-settings-card" data-tour="help-settings-motion">
            <h3>{UI_COPY.help.settings.motionTitle}</h3>
            <p>{UI_COPY.help.settings.motionDesc}</p>
            <div class="font-size-buttons" role="group" aria-label={UI_COPY.help.settings.motionOptionsAria}>
              <button
                type="button"
                class="font-btn"
                class:selected={motionPreference === 'system'}
                aria-pressed={motionPreference === 'system'}
                on:click={() => setMotionPreference('system')}
              >
                {UI_COPY.help.settings.motionSystem}
              </button>
              <button
                type="button"
                class="font-btn"
                class:selected={motionPreference === 'reduced'}
                aria-pressed={motionPreference === 'reduced'}
                on:click={() => setMotionPreference('reduced')}
              >
                {UI_COPY.help.settings.motionReduced}
              </button>
              <button
                type="button"
                class="font-btn"
                class:selected={motionPreference === 'full'}
                aria-pressed={motionPreference === 'full'}
                on:click={() => setMotionPreference('full')}
              >
                {UI_COPY.help.settings.motionFull}
              </button>
            </div>
          </section>
          <section class="help-settings-card" data-tour="help-settings-startup">
            <h3>{UI_COPY.help.settings.startupViewTitle}</h3>
            <p>{UI_COPY.help.settings.startupViewDesc}</p>
            <label class="control-stack">
              <span>{UI_COPY.help.settings.openAppIn}</span>
              <select
                value={startupViewMode}
                on:change={(e) => setStartupViewMode((e.currentTarget as HTMLSelectElement).value as StartupViewMode)}
              >
                <option value="remember">{UI_COPY.help.settings.startupRemember}</option>
                <option value="cards">{UI_COPY.help.settings.startupCards}</option>
                <option value="list">{UI_COPY.help.settings.startupList}</option>
                <option value="kanban">{UI_COPY.help.settings.startupKanban}</option>
              </select>
            </label>
          </section>
          <section class="help-settings-card">
            <h3>{UI_COPY.help.settings.defaultSortTitle}</h3>
            <p>{UI_COPY.help.settings.defaultSortDesc}</p>
            <div class="help-settings-grid help-settings-grid--nested">
              <label class="control-stack">
                <span>{UI_COPY.help.settings.sortBy}</span>
                <select
                  value={defaultSortKey}
                  on:change={(e) =>
                    setDefaultSort((e.currentTarget as HTMLSelectElement).value as SortKey, defaultSortAscending)}
                >
                  <option value="due">{UI_COPY.help.settings.sortByDue}</option>
                  <option value="title">{UI_COPY.help.settings.sortByTitle}</option>
                  <option value="priority">{UI_COPY.help.settings.sortByPriority}</option>
                  <option value="owner">{UI_COPY.help.settings.sortByOwner}</option>
                  <option value="status">{UI_COPY.help.settings.sortByStatus}</option>
                  <option value="tags">{UI_COPY.help.settings.sortByTags}</option>
                  <option value="created">{UI_COPY.help.settings.sortByCreated}</option>
                </select>
              </label>
              <label class="control-stack">
                <span>{UI_COPY.help.settings.direction}</span>
                <select
                  value={defaultSortAscending ? 'asc' : 'desc'}
                  on:change={(e) =>
                    setDefaultSort(defaultSortKey, (e.currentTarget as HTMLSelectElement).value === 'asc')}
                >
                  <option value="asc">{UI_COPY.help.settings.directionAsc}</option>
                  <option value="desc">{UI_COPY.help.settings.directionDesc}</option>
                </select>
              </label>
            </div>
          </section>
          <section class="help-settings-card" data-tour="help-settings-restore">
            <h3>{UI_COPY.help.settings.restoreDefaultsTitle}</h3>
            <p>{UI_COPY.help.settings.restoreDefaultsDesc}</p>
            <button type="button" class="secondary" on:click={restoreDefaultSettings}>{UI_COPY.help.settings.restoreDefaultsCta}</button>
          </section>
        </div>
      {:else}
        <div class="help-about">
          <p class="help-about-version" aria-label={UI_COPY.help.about.versionAria}>{UI_COPY.help.about.versionPrefix} {APP_VERSION}</p>
          <h3>{UI_COPY.help.about.title}</h3>
          <p>{UI_COPY.help.about.body}</p>
          <h3>{UI_COPY.help.about.dtsTitle}</h3>
          <p>
            {UI_COPY.help.about.dtsPrefix}
            <a
              href="https://github.com/hmcts/dts-developer-challenge"
              target="_blank"
              rel="noopener noreferrer"
            >{UI_COPY.help.about.dtsLinkLabel}</a>
            {UI_COPY.help.about.dtsSuffix}
          </p>
          <h3>{UI_COPY.help.about.developerTitle}</h3>
          <p>
            {UI_COPY.help.about.developerPrefix}
            <a href="https://github.com/RESTful-Otaku" target="_blank" rel="noopener noreferrer">RESTful-Otaku</a>.
            {UI_COPY.help.about.sourcePrefix}
            <a
              href="https://github.com/RESTful-Otaku/gov-dts-submission"
              target="_blank"
              rel="noopener noreferrer"
            >gov-dts-submission</a>
            {UI_COPY.help.about.sourceSuffix}
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>
