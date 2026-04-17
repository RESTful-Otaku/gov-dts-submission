import type { Meta, StoryObj } from '@storybook/svelte'

import TaskControlsBar from '../components/tasks/TaskControlsBar.svelte'

const meta = {
  title: 'Tasks/TaskControlsBar',
  component: TaskControlsBar,
  args: {
    isNarrow: false,
    mobileSearchExpanded: false,
    showFilters: false,
    viewMode: 'cards',
    searchTerm: '',
    searchInput: null,
    onCreateClick: () => {},
    onToggleFilters: () => {},
    onSetViewMode: () => {},
    onSearchTermChange: () => {},
    onExpandMobileSearch: () => {},
    onCollapseMobileSearch: () => {},
    hasActiveFilters: false,
    onClearAllFilters: () => {},
    showBackToTop: false,
    onScrollToTop: () => {},
    showMenuInToolbar: false,
    menuOpen: false,
    onToggleMenu: () => {},
  },
} satisfies Meta<typeof TaskControlsBar>

export default meta
type Story = StoryObj<typeof meta>

export const Desktop: Story = {}
export const DesktopFiltersActive: Story = { args: { hasActiveFilters: true } }
export const MobileCollapsed: Story = { args: { isNarrow: true, mobileSearchExpanded: false } }
export const MobileCollapsedFiltersActive: Story = {
  args: { isNarrow: true, mobileSearchExpanded: false, hasActiveFilters: true },
}
export const MobileSearchExpanded: Story = { args: { isNarrow: true, mobileSearchExpanded: true } }
export const DesktopBackToTop: Story = { args: { showBackToTop: true } }
export const MobileBackToTop: Story = { args: { isNarrow: true, showBackToTop: true } }
export const DesktopMenuInToolbar: Story = { args: { showMenuInToolbar: true } }
export const MobileMenuInToolbar: Story = { args: { isNarrow: true, showMenuInToolbar: true } }

