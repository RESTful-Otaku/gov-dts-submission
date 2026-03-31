<script lang="ts">
  import { onMount } from 'svelte'
  import AppHeader from '../components/layout/AppHeader.svelte'
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
  import { setIndeterminate } from '../lib/dom/setIndeterminate'
  import { modalContentTransition } from '../lib/ui/modalContentTransition'

  const app = new TaskAppController()

  onMount(() => {
    app.bootstrap()
  })
</script>

<svelte:window on:keydown={(e) => app.onGlobalKeydown(e)} on:resize={() => app.handleResize()} />

<main class="app">
  <div
    class="app-sticky-top"
    class:app-sticky-top--mobile-search-open={app.isNarrow && app.mobileSearchExpanded}
  >
    <div class="app-sticky-top__header-slot">
      <div class="app-sticky-top__header-inner">
        <AppHeader
          menuOpen={app.helpModalOpen}
          onToggleMenu={() => {
            if (app.helpModalOpen) app.closeHelp()
            else app.openHelp('guide')
          }}
          ariaHidden={app.isNarrow && app.mobileSearchExpanded}
        />
      </div>
    </div>

    <TaskControlsBar
      isNarrow={app.isNarrow}
      mobileSearchExpanded={app.mobileSearchExpanded}
      showFilters={app.showFilters}
      viewMode={app.viewMode}
      searchTerm={app.searchTerm}
      bind:searchInput={app.searchInput}
      hasActiveFilters={app.hasActiveFilters}
      onClearAllFilters={() => app.clearAllFilters()}
      onCreateClick={() => app.openCreateModal()}
      onToggleFilters={() => app.toggleFilters()}
      onSetViewMode={(next) => app.setViewModeFromUi(next)}
      onSearchTermChange={(next) => (app.searchTerm = next)}
      onExpandMobileSearch={() => app.expandMobileSearch()}
      onCollapseMobileSearch={() => app.collapseMobileSearch()}
    />
  </div>

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
      </div>
    </div>

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
        clearAllFilters={() => app.clearAllFilters()}
        DATE_FORMAT={DATE_FORMAT}
        PICKER_I18N={PICKER_I18N}
      />
    {/if}

    {#if app.tasks.length > 0}
      <TaskDueMetricsStrip
        overdueCount={app.dueSummary.overdueCount}
        dueTodayCount={app.dueSummary.dueTodayCount}
        dueThisWeekCount={app.dueSummary.dueThisWeekCount}
      />
    {/if}

    {#if app.tasks.length === 0 && !app.loading}
      <p class="empty">No tasks yet. Click “Create task” to add one.</p>
    {:else}
      {#if app.viewMode === 'list'}
        <TasksListView
          isNarrow={app.isNarrow}
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
    bind:tagsInput={app.tagsInput}
    bind:dueDateTimeStr={app.dueDateTimeStr}
    bind:modalFirstInput={app.modalFirstInput}
    DATETIME_FORMAT={DATETIME_FORMAT}
    PICKER_I18N={PICKER_I18N}
    closeCreateModal={() => app.closeCreateModal()}
    handleCreateTask={(e) => app.handleCreateTask(e)}
    handleModalBackdropClick={(e) => app.handleModalBackdropClick(e)}
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

{#if app.tourRunning}
  <TourCoachLayer
    isNarrow={app.isNarrow}
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

{#if app.helpModalOpen}
  <HelpCenterModal
    isNarrow={app.isNarrow}
    helpActiveTab={app.helpActiveTab}
    tourSteps={app.tourSteps}
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
    handleModalBackdropClick={(e) => app.handleModalBackdropClick(e)}
  />
{/if}

<Toasts toasts={app.toasts} dismissToast={(id) => app.dismissToast(id)} />
