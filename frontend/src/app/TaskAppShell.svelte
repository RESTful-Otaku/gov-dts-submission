<script lang="ts">
  import { onMount } from 'svelte'
  import govLogo from '../../assets/gov_uk.webp'
  import AppHeader from '../components/layout/AppHeader.svelte'
  import AdminUsersPanel from '../components/auth/AdminUsersPanel.svelte'
  import AuditLogsPanel from '../components/auth/AuditLogsPanel.svelte'
  import AuthModeToggle from '../components/auth/AuthModeToggle.svelte'
  import FieldValidityIcon from '../components/forms/FieldValidityIcon.svelte'
  import PasswordField from '../components/forms/PasswordField.svelte'
  import HealthBanner from '../components/health/HealthBanner.svelte'
  import Toasts from '../components/notifications/Toasts.svelte'
  import TaskControlsBar from '../components/tasks/TaskControlsBar.svelte'
  import FiltersPanel from '../components/tasks/FiltersPanel.svelte'
  import TaskDueMetricsStrip from '../components/tasks/TaskDueMetricsStrip.svelte'
  import TasksCardsView from '../components/tasks/TasksCardsView.svelte'
  import TasksKanbanView from '../components/tasks/TasksKanbanView.svelte'
  import TasksListView from '../components/tasks/TasksListView.svelte'
  import CreateTaskModal from '../components/modals/CreateTaskModal.svelte'
  import EditTaskModal from '../components/modals/EditTaskModal.svelte'
  import DeleteTasksModal from '../components/modals/DeleteTasksModal.svelte'
  import DeleteUsersModal from '../components/modals/DeleteUsersModal.svelte'
  import EditUserModal from '../components/modals/EditUserModal.svelte'
  import HelpCenterModal from '../components/help/HelpCenterModal.svelte'
  import TourCoachLayer from '../components/onboarding/TourCoachLayer.svelte'
  import { formatDate } from '../lib/tasks/date'
  import { priorityLabel, statusLabel } from '../lib/tasks/taskMeta'
  import {
    DATETIME_FORMAT,
    DATE_FORMAT,
    KANBAN_COLUMNS,
    KANBAN_FLIP_MS,
    LIST_PAGE_SIZES,
    PICKER_I18N,
  } from '../lib/app/constants'
  import { TaskAppController } from '../lib/app/task-app/controller.svelte.js'
  import { UI_COPY } from '../lib/app/copy'
  import { adminContactMailtoHref } from '../lib/app/constants'
  import {
    emailFieldOk,
    nonEmptyOk,
    passwordStrengthOk,
    passwordsMatchOk,
  } from '../lib/app/authFieldValidation'
  import { setIndeterminate } from '../lib/dom/setIndeterminate'
  import { modalContentTransition } from '../lib/ui/modalContentTransition'

  const app = new TaskAppController()

  onMount(() => {
    app.bootstrap()
    return app.attachStickyChromeScroll()
  })
</script>

<svelte:window on:keydown={(e) => app.onGlobalKeydown(e)} on:resize={() => app.handleResize()} />

<main class="app">
  {#if app.canAccessTasks}
  <div
    class="app-sticky-top"
    class:app-sticky-top--mobile-search-open={app.isNarrow && app.mobileSearchExpanded}
    class:app-sticky-top--chrome-collapsed={app.stickyChromeCollapsed}
  >
    <div class="app-sticky-top__header-slot">
      <div class="app-sticky-top__header-inner">
        <AppHeader
          menuOpen={app.helpModalOpen}
          onToggleMenu={() => {
            if (app.helpModalOpen) app.closeHelp()
            else app.openHelp('profile')
          }}
          ariaHidden={app.isNarrow && app.mobileSearchExpanded}
          hideMenuButton={(app.isAuthRequired && !app.currentUser) || app.stickyChromeCollapsed}
          menuInitials={app.menuInitials}
        />
      </div>
    </div>

    <TaskControlsBar
      isNarrow={app.isNarrow}
      mobileSearchExpanded={app.mobileSearchExpanded}
      showBackToTop={app.stickyChromeCollapsed}
      onScrollToTop={() => app.scrollChromeToTop()}
      showFilters={app.showFilters}
      viewMode={app.viewMode}
      isAdmin={app.isAdmin}
      adminTabsAvailable={app.adminShellReady}
      canMutateTasks={app.canMutateTasks}
      activeMainTab={app.activeMainTab}
      searchTerm={app.searchTerm}
      bind:searchInput={app.searchInput}
      hasActiveFilters={app.hasActiveFilters}
      activeFilterChips={app.activeFilterChips}
      onClearAllFilters={() => app.clearAllFilters()}
      onRemoveActiveFilterChip={(id, kind) => app.removeActiveFilterChip(id, kind)}
      onCreateClick={() => app.openCreateModal()}
      onSetMainTab={(tab) => app.setActiveMainTab(tab)}
      onToggleFilters={() => app.toggleFilters()}
      onSetViewMode={(next) => app.setViewModeFromUi(next)}
      onSearchTermChange={(next) => (app.searchTerm = next)}
      onExpandMobileSearch={() => app.expandMobileSearch()}
      onCollapseMobileSearch={() => app.collapseMobileSearch()}
      showMenuInToolbar={app.stickyChromeCollapsed}
      showUserMenu={Boolean(app.currentUser) || !app.isAuthRequired}
      menuOpen={app.helpModalOpen}
      onToggleMenu={() => {
        if (app.helpModalOpen) app.closeHelp()
        else app.openHelp('profile')
      }}
      menuInitials={app.menuInitials}
    />

    {#if app.showFilters}
      <FiltersPanel
        bind:statusFilter={app.statusFilter}
        bind:priorityFilter={app.priorityFilter}
        bind:ownerFilter={app.ownerFilter}
        bind:tagFilters={app.tagFilters}
        bind:filterFrom={app.filterFrom}
        bind:filterTo={app.filterTo}
        bind:sortKey={app.sortKey}
        bind:sortAscending={app.sortAscending}
        uniqueOwners={app.uniqueOwners}
        allTags={app.allTags}
        hasActiveFilters={app.hasActiveFilters}
        savedViews={app.savedViews.map((v) => ({ id: v.id, name: v.name }))}
        selectedSavedViewId={app.selectedSavedViewId}
        onSelectSavedView={(id) => {
          if (!id) app.selectedSavedViewId = ''
          else app.applySavedView(id)
        }}
        onSaveCurrentView={(name) => app.saveCurrentView(name)}
        onDeleteSavedView={(id) => app.deleteSavedView(id)}
        clearAllFilters={() => app.clearAllFilters()}
        DATE_FORMAT={DATE_FORMAT}
        PICKER_I18N={PICKER_I18N}
      />
    {/if}
  </div>

  {#if app.activeMainTab === 'tasks'}
  <section class="card" data-tour="task-area">
    {#if app.healthStatus !== 'ok'}
      <HealthBanner
        healthStatus={app.healthStatus}
        healthMessage={app.healthMessage}
        refreshHealth={() => app.refreshHealth()}
      />
    {/if}
    <div class="card-header">
      <div class="card-header-main">
        {#if app.loading}
          <span class="badge">Loading…</span>
        {/if}
        {#if import.meta.env.DEV}
          <span class="badge">Server query mode: {app.isServerTaskQueryMode ? 'ON' : 'OFF'}</span>
        {/if}
      </div>
    </div>

    {#if app.tasks.length > 0}
      <TaskDueMetricsStrip
        overdueCount={app.dueSummary.overdueCount}
        dueTodayCount={app.dueSummary.dueTodayCount}
        dueThisWeekCount={app.dueSummary.dueThisWeekCount}
        onFocusToday={() => app.applyTodayWorkspace()}
      />
    {/if}

    {#if app.tasks.length === 0 && !app.loading}
      <p class="empty">
        {app.canMutateTasks ? 'No tasks yet. Click “Create task” to add one.' : 'No tasks yet.'}
      </p>
    {:else}
      {#if app.viewMode === 'list'}
        <TasksListView
          isNarrow={app.isNarrow}
          canMutateTasks={app.canMutateTasks}
          sortKey={app.sortKey}
          sortAscending={app.sortAscending}
          onSortColumn={(k) => app.toggleTaskTableSort(k)}
          tourSpotlightStepId={app.tourSpotlightStepId}
          tourAnchorTaskId={app.tourAnchorTaskId}
          visibleTasks={app.visibleTasks}
          listTasksDisplay={app.listTasksDisplay}
          selectedTaskIds={app.selectedTaskIds}
          isSelectAllIndeterminate={app.isSelectAllIndeterminate}
          allVisibleTasksSelected={app.allVisibleTasksSelected}
          totalListPages={app.totalListPages}
          LIST_PAGE_SIZES={LIST_PAGE_SIZES}
          STATUS_OPTIONS={app.statusOptions}
          bind:listPage={app.listPage}
          bind:listPageSize={app.listPageSize}
          bind:quickAddTitle={app.quickAddTitle}
          bind:quickAddDateTimeStr={app.quickAddDateTimeStr}
          bind:quickAddSubmitting={app.quickAddSubmitting}
          DATETIME_FORMAT={DATETIME_FORMAT}
          PICKER_I18N={PICKER_I18N}
          setIndeterminate={setIndeterminate}
          handleQuickAdd={(e) => app.handleQuickAdd(e)}
          toggleTaskSelection={(id) => app.toggleTaskSelection(id)}
          selectAllInList={() => app.selectAllInList()}
          selectAllInListView={() => app.selectAllInListView()}
          clearListSelection={() => app.clearListSelection()}
          bulkSetStatus={(s) => app.bulkSetStatus(s)}
          openBulkDeleteModal={() => app.openBulkDeleteModal()}
          openEditModal={(t) => app.openEditModal(t)}
          handleDeleteTask={(id) => app.handleDeleteTask(id)}
          filterByTag={(tag) => app.filterByTag(tag)}
          priorityLabel={priorityLabel}
          statusLabel={statusLabel}
          formatDate={formatDate}
        />
      {:else if app.viewMode === 'kanban'}
        <TasksKanbanView
          visibleTasks={app.visibleTasks}
          isNarrow={app.isNarrow}
          canMutateTasks={app.canMutateTasks}
          tourSpotlightStepId={app.tourSpotlightStepId}
          tourAnchorTaskId={app.tourAnchorTaskId}
          KANBAN_COLUMNS={KANBAN_COLUMNS}
          KANBAN_FLIP_MS={KANBAN_FLIP_MS}
          tasksForColumn={(s) => app.tasksForColumn(s)}
          handleKanbanConsider={(s, e) => app.handleKanbanConsider(s, e)}
          handleKanbanFinalize={(s, e) => app.handleKanbanFinalize(s, e)}
          filterByTag={(tag) => app.filterByTag(tag)}
          openEditModal={(t) => app.openEditModal(t)}
          handleDeleteTask={(id) => app.handleDeleteTask(id)}
          onOpenReader={() => app.markOnboardingStep('open_task_reader')}
          statusLabel={statusLabel}
          priorityLabel={priorityLabel}
          formatDate={formatDate}
        />
      {:else}
        <TasksCardsView
          isNarrow={app.isNarrow}
          canMutateTasks={app.canMutateTasks}
          tourSpotlightStepId={app.tourSpotlightStepId}
          tourAnchorTaskId={app.tourAnchorTaskId}
          visibleTasks={app.visibleTasks}
          priorityLabel={priorityLabel}
          statusLabel={statusLabel}
          formatDate={formatDate}
          openEditModal={(t) => app.openEditModal(t)}
          handleDeleteTask={(id) => app.handleDeleteTask(id)}
          filterByTag={(tag) => app.filterByTag(tag)}
          onOpenReader={() => app.markOnboardingStep('open_task_reader')}
          onSwipeGesture={() => app.markOnboardingStep('card_swipe')}
        />
      {/if}
    {/if}
  </section>
  {:else if app.currentUser && app.isAdmin && app.activeMainTab === 'users' && app.adminShellReady}
    <AdminUsersPanel
      users={app.users}
      usersTotal={app.usersTotal}
      usersLoading={app.usersLoading}
      bind:usersSearchTerm={app.usersSearchTerm}
      usersRoleFilter={app.usersRoleFilter}
      showUsersFilters={app.showUsersFilters}
      onToggleUsersFilters={() => app.toggleUsersFiltersPanel()}
      onClearUsersFilters={() => app.clearUsersFilters()}
      onSetUsersRoleFilter={(role) => app.setUsersRoleFilter(role)}
      usersSortKey={app.usersSortKey}
      usersSortAscending={app.usersSortAscending}
      onToggleUsersSort={(field) => app.toggleUsersSort(field)}
      bind:usersPage={app.usersPage}
      bind:usersPageSize={app.usersPageSize}
      totalUserPages={app.totalUserPages}
      {LIST_PAGE_SIZES}
      selectedUserIds={app.selectedUserIds}
      onToggleUserSelection={(id) => app.toggleUserSelection(id)}
      onSelectAllUsersOnPage={() => app.selectAllUsersOnPage()}
      onClearUserSelection={() => app.clearUserSelection()}
      onOpenEditUser={(u) => app.openEditUserModal(u)}
      onSetUserRole={(id, role) => app.updateAdminUserRole(id, role)}
      onRequestPasswordReset={(id) => app.requestAdminUserPasswordReset(id)}
      onOpenDeleteOne={(id) => app.openSingleDeleteUserModal(id)}
      onOpenBulkDelete={() => app.openBulkDeleteUsersModal()}
    />
  {:else if app.currentUser && app.isAdmin && app.activeMainTab === 'audit' && app.adminShellReady}
    <AuditLogsPanel
      users={app.users}
      auditLogs={app.auditLogs}
      auditUserId={app.auditUserId}
      auditQuery={app.auditQuery}
      auditChangedField={app.auditChangedField}
      auditSort={app.auditSort}
      auditOrder={app.auditOrder}
      onSetAuditUserId={(value) => {
        app.auditUserId = value
        void app.loadAuditLogs()
      }}
      onSetAuditQuery={(value) => {
        app.auditQuery = value
        void app.loadAuditLogs()
      }}
      onSetAuditChangedField={(field) => app.setAuditChangedField(field)}
      onToggleAuditSort={(field) => app.toggleAuditSort(field)}
      onClearAuditFilters={() => app.clearAuditFilters()}
      onRefresh={() => app.loadAuditLogs()}
    />
  {:else if app.currentUser && app.isAdmin && (app.activeMainTab === 'users' || app.activeMainTab === 'audit') && !app.adminShellReady}
    <section class="card admin-viewport-gate" aria-live="polite">
      <h2 class="admin-viewport-gate__title">Screen too small for administration</h2>
      <p class="muted">
        Users and audit logs need a wider desktop browser window (at least about 900px). Use a larger display, or resize this
        window. Native mobile builds do not include the admin console.
      </p>
      <button type="button" class="btn-icon-compact" on:click={() => app.setActiveMainTab('tasks')}>
        <span class="btn-icon-compact__icon" aria-hidden="true">▦</span>
        <span class="btn-icon-compact__label">Back to tasks</span>
      </button>
    </section>
  {/if}
  {/if}

  {#if !app.currentUser && !app.canAccessTasks}
    <div class="auth-gate-outer" class:auth-gate-outer--native-shell={app.isNarrow}>
      <section
        class="card auth-gate-panel"
        class:auth-gate-panel--register-wide={app.authMode === 'register' && !app.isNarrow}
        class:auth-gate-panel--native-shell={app.isNarrow}
      >
        <div class="auth-gate-brand">
          <img src={govLogo} alt="GOV.UK" class="auth-gate-brand__logo" />
          <div>
            <h2 class="auth-gate-brand__title">{UI_COPY.header.appTitle}</h2>
            <p class="auth-gate-brand__subtitle">{UI_COPY.header.appSubtitle}</p>
          </div>
        </div>
        {#if app.authGateSubview === 'recover'}
          <h3 class="auth-gate-heading">Recover account</h3>
          <p class="muted auth-gate-lead">Enter your email. If an account exists, we will send reset instructions when the service is online.</p>
          <form
            class="auth-gate-form"
            on:submit|preventDefault={() => app.submitAuthGateRecover()}
          >
            <label class="control-stack auth-gate-field--full">
              <span class="auth-field-label">Email</span>
              <div
                class="auth-input-line auth-input-line--with-validity"
                class:auth-input-line--show-validity={Boolean(app.authFieldBlurred['recoverEmail'])}
              >
                <input
                  class="auth-input-line__field"
                  class:input-invalid={Boolean(app.authErrors.recoverEmail)}
                  aria-invalid={Boolean(app.authErrors.recoverEmail)}
                  type="email"
                  value={app.authRecoverEmail}
                  on:input={(e) => app.setAuthRecoverEmail((e.currentTarget as HTMLInputElement).value)}
                  on:blur={() => app.blurAuthField('recoverEmail')}
                />
                <span class="auth-input-line__validity" aria-hidden="true">
                  <FieldValidityIcon
                    inline
                    blurred={Boolean(app.authFieldBlurred['recoverEmail'])}
                    valid={emailFieldOk(app.authRecoverEmail)}
                  />
                </span>
              </div>
              {#if app.authErrors.recoverEmail}<small class="control-error">{app.authErrors.recoverEmail}</small>{/if}
            </label>
            <div class="help-tour-actions auth-gate-field--full">
              <button type="submit">Send reset link</button>
              <button type="button" class="secondary" on:click={() => app.backAuthGateSignin()}>Back to sign in</button>
            </div>
          </form>
          <p class="muted auth-gate-admin-hint">
            Still stuck?
            <a href={adminContactMailtoHref()}>Contact the administrator</a>
            for access or profile changes.
          </p>
        {:else}
          <h3 class="auth-gate-heading">Sign in</h3>
          <p class="muted auth-gate-lead">Please log in or register to access tasks.</p>
          <div class="auth-gate-mode-row">
            <AuthModeToggle mode={app.authMode} onSetMode={(m) => app.setAuthMode(m)} />
          </div>
          <form
            class="auth-gate-form"
            class:auth-gate-form--register-two-col={app.authMode === 'register' && !app.isNarrow}
            on:submit|preventDefault={() => app.submitAuth()}
          >
            <label class="control-stack auth-gate-field--full">
              <span class="auth-field-label">Email</span>
              <div
                class="auth-input-line auth-input-line--with-validity"
                class:auth-input-line--show-validity={Boolean(app.authFieldBlurred['email'])}
              >
                <input
                  class="auth-input-line__field"
                  class:input-invalid={Boolean(app.authErrors.email)}
                  aria-invalid={Boolean(app.authErrors.email)}
                  type="email"
                  value={app.authEmail}
                  on:input={(e) => app.setAuthEmail((e.currentTarget as HTMLInputElement).value)}
                  on:blur={() => app.blurAuthField('email')}
                />
                <span class="auth-input-line__validity" aria-hidden="true">
                  <FieldValidityIcon
                    inline
                    blurred={Boolean(app.authFieldBlurred['email'])}
                    valid={emailFieldOk(app.authEmail)}
                  />
                </span>
              </div>
              {#if app.authErrors.email}<small class="control-error">{app.authErrors.email}</small>{/if}
            </label>
            {#if app.authMode === 'register'}
              <label class="control-stack">
                <span class="auth-field-label">First name</span>
                <div
                  class="auth-input-line auth-input-line--with-validity"
                  class:auth-input-line--show-validity={Boolean(app.authFieldBlurred['firstName'])}
                >
                  <input
                    class="auth-input-line__field"
                    class:input-invalid={Boolean(app.authErrors.firstName)}
                    aria-invalid={Boolean(app.authErrors.firstName)}
                    value={app.authFirstName}
                    on:input={(e) => app.setAuthFirstName((e.currentTarget as HTMLInputElement).value)}
                    on:blur={() => app.blurAuthField('firstName')}
                  />
                  <span class="auth-input-line__validity" aria-hidden="true">
                    <FieldValidityIcon
                      inline
                      blurred={Boolean(app.authFieldBlurred['firstName'])}
                      valid={nonEmptyOk(app.authFirstName)}
                    />
                  </span>
                </div>
                {#if app.authErrors.firstName}<small class="control-error">{app.authErrors.firstName}</small>{/if}
              </label>
              <label class="control-stack">
                <span class="auth-field-label">Last name</span>
                <div
                  class="auth-input-line auth-input-line--with-validity"
                  class:auth-input-line--show-validity={Boolean(app.authFieldBlurred['lastName'])}
                >
                  <input
                    class="auth-input-line__field"
                    class:input-invalid={Boolean(app.authErrors.lastName)}
                    aria-invalid={Boolean(app.authErrors.lastName)}
                    value={app.authLastName}
                    on:input={(e) => app.setAuthLastName((e.currentTarget as HTMLInputElement).value)}
                    on:blur={() => app.blurAuthField('lastName')}
                  />
                  <span class="auth-input-line__validity" aria-hidden="true">
                    <FieldValidityIcon
                      inline
                      blurred={Boolean(app.authFieldBlurred['lastName'])}
                      valid={nonEmptyOk(app.authLastName)}
                    />
                  </span>
                </div>
                {#if app.authErrors.lastName}<small class="control-error">{app.authErrors.lastName}</small>{/if}
              </label>
              <label class="control-stack auth-gate-field--full">
                <span class="auth-field-label">Display name</span>
                <div
                  class="auth-input-line auth-input-line--with-validity"
                  class:auth-input-line--show-validity={Boolean(app.authFieldBlurred['username'])}
                >
                  <input
                    class="auth-input-line__field"
                    class:input-invalid={Boolean(app.authErrors.username)}
                    aria-invalid={Boolean(app.authErrors.username)}
                    aria-label="Display name"
                    value={app.authUsername}
                    on:input={(e) => app.setAuthUsername((e.currentTarget as HTMLInputElement).value)}
                    on:blur={() => app.blurAuthField('username')}
                  />
                  <span class="auth-input-line__validity" aria-hidden="true">
                    <FieldValidityIcon
                      inline
                      blurred={Boolean(app.authFieldBlurred['username'])}
                      valid={nonEmptyOk(app.authUsername)}
                    />
                  </span>
                </div>
                {#if app.authErrors.username}<small class="control-error">{app.authErrors.username}</small>{/if}
              </label>
            {/if}
            <div class="auth-gate-field--full auth-password-wrap">
              <span class="auth-field-label">Password</span>
              <PasswordField
                id="auth-gate-password"
                label=""
                bind:value={app.authPassword}
                autocomplete={app.authMode === 'register' ? 'new-password' : 'current-password'}
                invalid={Boolean(app.authErrors.password)}
                showPassword={app.authShowPassword}
                onToggleShow={() => (app.authShowPassword = !app.authShowPassword)}
                onBlur={() => app.blurAuthField('password')}
                validityBlurred={Boolean(app.authFieldBlurred['password'])}
                validityValid={passwordStrengthOk(app.authPassword)}
              />
              {#if app.authErrors.password}<small class="control-error">{app.authErrors.password}</small>{/if}
            </div>
            {#if app.authMode === 'register'}
              <div class="auth-gate-field--full auth-password-wrap">
                <span class="auth-field-label">Confirm password</span>
                <PasswordField
                  id="auth-gate-password-confirm"
                  label=""
                  bind:value={app.authPasswordConfirm}
                  autocomplete="new-password"
                  invalid={Boolean(app.authErrors.passwordConfirm)}
                  showPassword={app.authShowPassword}
                  onToggleShow={() => (app.authShowPassword = !app.authShowPassword)}
                  onBlur={() => app.blurAuthField('passwordConfirm')}
                  validityBlurred={Boolean(app.authFieldBlurred['passwordConfirm'])}
                  validityValid={passwordsMatchOk(app.authPassword, app.authPasswordConfirm) &&
                    passwordStrengthOk(app.authPasswordConfirm)}
                />
                {#if app.authErrors.passwordConfirm}<small class="control-error">{app.authErrors.passwordConfirm}</small>{/if}
              </div>
            {/if}
            <div class="help-tour-actions auth-gate-field--full">
              <button type="submit">{app.authMode === 'login' ? 'Login' : 'Create account'}</button>
              {#if app.authMode === 'login'}
                <button type="button" class="secondary" on:click={() => app.openAuthGateRecover()}>Recover account</button>
              {/if}
            </div>
          </form>
          <p class="muted auth-gate-admin-hint">
            Need an account or permission change?
            <a href={adminContactMailtoHref()}>Email the administrator</a>.
          </p>
        {/if}
        {#if app.authErrors.form}<p class="control-error" role="alert">{app.authErrors.form}</p>{/if}
      </section>
    </div>
  {/if}
</main>

<!--
  Modals, tour, help, and toasts sit outside <main> so fixed overlays are not affected by
  main’s flex/formatting context (avoids obscure stacking / hit-testing issues in production).
-->
{#if app.createModalOpen}
  <CreateTaskModal
    isNarrow={app.isNarrow}
    modalContentTransition={modalContentTransition}
    bind:title={app.title}
    bind:description={app.description}
    bind:status={app.status}
    bind:priority={app.priority}
    bind:owner={app.owner}
    ownerDisplayNames={app.assignableDisplayNames}
    bind:tagsInput={app.tagsInput}
    bind:dueDateTimeStr={app.dueDateTimeStr}
    bind:modalFirstInput={app.modalFirstInput}
    DATETIME_FORMAT={DATETIME_FORMAT}
    PICKER_I18N={PICKER_I18N}
    closeCreateModal={() => app.closeCreateModal()}
    handleCreateTask={(e) => app.handleCreateTask(e)}
    handleModalBackdropClick={(e) => app.handleModalBackdropClick(e)}
    titleFieldBlurred={app.createFieldBlurred.title}
    dueFieldBlurred={app.createFieldBlurred.due}
    titleFieldValid={app.createTaskTitleFieldValid}
    dueFieldValid={app.createTaskDueFieldValid}
    onTitleFieldBlur={() => app.touchCreateField('title')}
    onDueFieldBlur={() => app.touchCreateField('due')}
  />
{/if}

{#if app.editModalTaskId !== null}
  <EditTaskModal
    isNarrow={app.isNarrow}
    modalContentTransition={modalContentTransition}
    bind:editTitle={app.editTitle}
    bind:editDescription={app.editDescription}
    bind:editStatus={app.editStatus}
    bind:editPriority={app.editPriority}
    bind:editTagsInput={app.editTagsInput}
    bind:editModalFirstInput={app.editModalFirstInput}
    closeEditModal={() => app.closeEditModal()}
    handleEditTask={(e) => app.handleEditTask(e)}
    handleModalBackdropClick={(e) => app.handleModalBackdropClick(e)}
    titleFieldBlurred={app.editFieldBlurred.title}
    titleFieldValid={app.editTaskTitleFieldValid}
    onTitleFieldBlur={() => app.touchEditField('title')}
  />
{/if}

{#if app.deleteModalTaskIds !== null && app.deleteModalTaskIds.length > 0}
  <DeleteTasksModal
    tasks={app.tasks}
    deleteModalTaskIds={app.deleteModalTaskIds}
    handleModalBackdropClick={(e) => app.handleModalBackdropClick(e)}
    closeDeleteModal={() => app.closeDeleteModal()}
    performDeleteTask={() => app.performDeleteTask()}
  />
{/if}

{#if app.editUserTarget}
  <EditUserModal
    isNarrow={app.isNarrow}
    modalContentTransition={modalContentTransition}
    bind:firstName={app.editUserFirstName}
    bind:lastName={app.editUserLastName}
    bind:displayName={app.editUserUsername}
    bind:editUserModalFirstInput={app.editUserModalFirstInput}
    closeEditUserModal={() => app.closeEditUserModal()}
    saveEditUserProfile={() => app.saveEditUserProfile()}
    handleModalBackdropClick={(e) => app.handleModalBackdropClick(e)}
  />
{/if}

{#if app.deleteUserModalIds !== null && app.deleteUserModalIds.length > 0}
  <DeleteUsersModal
    users={app.users}
    deleteUserModalIds={app.deleteUserModalIds}
    handleModalBackdropClick={(e) => app.handleModalBackdropClick(e)}
    closeDeleteUsersModal={() => app.closeDeleteUsersModal()}
    performDeleteUsers={() => app.performDeleteUsers()}
  />
{/if}

{#if app.helpModalOpen && (app.canAccessTasks || !app.isAuthRequired)}
  <HelpCenterModal
    isNarrow={app.isNarrow}
    helpActiveTab={app.helpActiveTab}
    checklist={app.checklist}
    checklistDone={app.checklistProgressState.done}
    checklistTotal={app.checklistProgressState.total}
    theme={app.theme}
    fontSize={app.fontSize}
    density={app.density}
    motionPreference={app.motionPreference}
    startupViewMode={app.startupViewMode}
    defaultSortKey={app.defaultSortKey}
    defaultSortAscending={app.defaultSortAscending}
    currentUser={app.currentUser}
    authMode={app.authMode}
    authEmail={app.authEmail}
    authFirstName={app.authFirstName}
    authLastName={app.authLastName}
    authUsername={app.authUsername}
    authPassword={app.authPassword}
    authResetMode={app.authResetMode}
    authResetToken={app.authResetToken}
    authNewPassword={app.authNewPassword}
    authErrors={app.authErrors}
    closeHelp={() => app.closeHelp()}
    setHelpTab={(t) => app.setHelpTab(t)}
    setTheme={(t) => app.setTheme(t)}
    setFontSize={(f) => app.setFontSize(f)}
    setDensity={(d) => app.setDensity(d)}
    setMotionPreference={(m) => app.setMotionPreference(m)}
    setStartupViewMode={(v) => app.setStartupViewMode(v)}
    setDefaultSort={(k, asc) => app.setDefaultSort(k, asc)}
    restoreDefaultSettings={() => app.restoreDefaultSettings()}
    startGuidedTour={() => app.startGuidedTour()}
    skipWelcomeForever={() => app.skipWelcomeForever()}
    replayTourFromStep={(id) => app.replayTourFromStep(id)}
    resetOnboardingProgress={() => app.resetOnboardingProgress()}
    setAuthMode={(mode) => app.setAuthMode(mode)}
    setAuthEmail={(value) => app.setAuthEmail(value)}
    setAuthFirstName={(value) => app.setAuthFirstName(value)}
    setAuthLastName={(value) => app.setAuthLastName(value)}
    setAuthUsername={(value) => app.setAuthUsername(value)}
    setAuthPassword={(value) => app.setAuthPassword(value)}
    setAuthResetMode={(mode) => app.setAuthResetMode(mode)}
    setAuthResetToken={(value) => app.setAuthResetToken(value)}
    setAuthNewPassword={(value) => app.setAuthNewPassword(value)}
    submitAuth={() => app.submitAuth()}
    requestPasswordRecovery={() => app.requestPasswordRecovery()}
    submitPasswordReset={() => app.submitPasswordReset()}
    signOut={() => app.signOut()}
    startOAuth={(provider) => app.startOAuth(provider)}
    handleModalBackdropClick={(e) => app.handleModalBackdropClick(e)}
  />
{/if}

{#if app.tourRunning}
  <TourCoachLayer
    isNarrow={app.isNarrow}
    helpModalOpen={app.helpModalOpen}
    helpActiveTab={app.helpActiveTab}
    mobileSearchExpanded={app.mobileSearchExpanded}
    tourStepIndex={app.tourStepIndex}
    tourSteps={app.tourSteps}
    checklist={app.checklist}
    checklistDone={app.checklistProgressState.done}
    checklistTotal={app.checklistProgressState.total}
    stopTour={() => app.stopTour()}
    nextTourStep={() => app.nextTourStep()}
    prevTourStep={() => app.prevTourStep()}
    markOnboardingStep={(id) => app.markOnboardingStep(id)}
  />
{/if}

<Toasts toasts={app.toasts} dismissToast={(id) => app.dismissToast(id)} />

<style>
  .auth-gate-outer {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: min(72vh, calc(100dvh - 3rem));
    padding: 1rem 1rem 2rem;
    width: 100%;
    box-sizing: border-box;
  }

  /* Narrow / mobile: full-bleed auth — no card chrome, more viewport (native shell feel). */
  .auth-gate-outer--native-shell {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    min-height: calc(100dvh - 0.25rem);
    min-height: calc(100svh - 0.25rem);
    padding: max(0.5rem, env(safe-area-inset-top, 0px)) max(var(--mobile-inline-gutter-right, 1rem), env(safe-area-inset-right, 0px))
      max(1.25rem, env(safe-area-inset-bottom, 0px)) max(var(--mobile-inline-gutter, 1rem), env(safe-area-inset-left, 0px));
  }

  .auth-gate-panel {
    width: 100%;
    max-width: 34rem;
    margin: 0 auto;
    border: 2px solid var(--color-border);
    box-shadow: 0 10px 28px rgba(11, 12, 12, 0.08);
    transition:
      max-width 0.38s cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow 0.38s ease;
  }

  .auth-gate-panel.auth-gate-panel--native-shell {
    max-width: none;
    margin: 0;
    border: none;
    box-shadow: none;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    /* Slightly tighter than desktop card; still readable */
    padding-top: 1rem;
    padding-bottom: 1.25rem;
  }

  .auth-gate-panel--register-wide {
    max-width: min(52rem, 96vw);
  }

  .auth-gate-heading {
    margin-top: 0;
  }

  .auth-gate-lead {
    margin-top: 0.25rem;
  }

  .auth-gate-mode-row {
    margin: 1rem 0 1.25rem;
  }

  .auth-gate-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .auth-gate-form--register-two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem 1.25rem;
    align-items: start;
  }

  .auth-gate-form--register-two-col .auth-gate-field--full {
    grid-column: 1 / -1;
  }

  .auth-field-label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-muted);
    margin-bottom: 0.2rem;
  }

  .auth-input-line--with-validity {
    position: relative;
    width: 100%;
  }

  .auth-input-line__field {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.6rem;
    font: inherit;
  }

  .auth-input-line--show-validity .auth-input-line__field {
    padding-right: 2.15rem;
  }

  .auth-input-line__validity {
    position: absolute;
    right: 0.45rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    display: flex;
    align-items: center;
  }

  .auth-password-wrap :global(.password-field__label:empty) {
    display: none;
  }

  .auth-gate-admin-hint {
    margin-top: 1rem;
    font-size: 0.88rem;
    line-height: 1.45;
  }

  .auth-gate-admin-hint a {
    white-space: nowrap;
  }

  .auth-gate-outer--native-shell .auth-gate-brand {
    border-bottom: none;
    padding-bottom: 1rem;
    margin-bottom: 0.5rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .auth-gate-panel {
      transition: none;
    }
  }

  .admin-viewport-gate {
    max-width: 40rem;
    margin: 0 auto;
  }

  .admin-viewport-gate__title {
    margin-top: 0;
  }

  .auth-gate-brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.25rem 0.5rem 0.75rem;
    margin-bottom: 0.75rem;
    border-bottom: 1px solid var(--color-border);
  }

  .auth-gate-brand__logo {
    width: 2.25rem;
    height: 2.25rem;
    object-fit: contain;
  }

  .auth-gate-brand__title {
    margin: 0;
    font-size: 1rem;
  }

  .auth-gate-brand__subtitle {
    margin: 0.1rem 0 0;
    font-size: 0.82rem;
    color: var(--color-muted);
  }
</style>
