<script lang="ts">
  import { UI_COPY } from '../../lib/app/copy'
  import SveltyPicker from 'svelty-picker'
  import type { i18nType } from 'svelty-picker/i18n'

  export let filterFrom: string
  export let filterTo: string
  export let dateFormat: string
  export let pickerI18n: i18nType
</script>

<div class="date-range">
  <label>
    <span class="control-label">{UI_COPY.tasks.dueDateRange.from}</span>
    <SveltyPicker
      mode="date"
      format={dateFormat}
      formatType="standard"
      bind:value={filterFrom}
      placeholder={UI_COPY.tasks.dueDateRange.placeholder}
      i18n={pickerI18n}
      weekStart={1}
      todayBtn
      clearBtn
      manualInput
      inputClasses="filter-due-input"
    />
  </label>
  <label>
    <span class="control-label">{UI_COPY.tasks.dueDateRange.to}</span>
    <SveltyPicker
      mode="date"
      format={dateFormat}
      formatType="standard"
      bind:value={filterTo}
      placeholder={UI_COPY.tasks.dueDateRange.placeholder}
      i18n={pickerI18n}
      weekStart={1}
      todayBtn
      clearBtn
      manualInput
      inputClasses="filter-due-input"
    />
  </label>
</div>
