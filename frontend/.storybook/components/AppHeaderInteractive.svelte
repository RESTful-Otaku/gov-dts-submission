<script lang="ts">
  import AppHeader from '../../src/components/layout/AppHeader.svelte'
  import { syncRootAppearance } from '../../src/lib/app/preferences'
  import type { FontSize, Theme } from '../../src/lib/app/types'

  interface Props {
    /** Driven by Storybook globals via `render` in the meta. */
    initialTheme?: Theme
    initialFontSize?: FontSize
  }

  let { initialTheme = 'light', initialFontSize = 'md' }: Props = $props()

  let theme = $state<Theme>('light')
  let fontSize = $state<FontSize>('md')

  $effect(() => {
    theme = initialTheme
    fontSize = initialFontSize
    syncRootAppearance(theme, fontSize)
  })

  function setTheme(next: Theme): void {
    theme = next
    syncRootAppearance(theme, fontSize)
  }

  function setFontSize(next: FontSize): void {
    fontSize = next
    syncRootAppearance(theme, fontSize)
  }
</script>

<AppHeader menuOpen={false} onToggleMenu={() => {}} />
