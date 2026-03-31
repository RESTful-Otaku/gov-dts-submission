import { expect, test } from '@playwright/test'

test.describe('app smoke (API + built UI)', () => {
  test.describe.configure({ mode: 'serial' })

  test('loads shell and shows seeded demo task from API', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Caseworker task manager' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Review case bundle', exact: true })).toBeVisible({ timeout: 30_000 })
  })

  test('create task flow (API seed): task appears in UI', async ({ page, request }) => {
    const title = `E2E created task ${Date.now()}`
    const dueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()

    const res = await request.post('/api/tasks', {
      data: {
        title,
        status: 'todo',
        priority: 'normal',
        dueAt,
      },
    })
    expect(res.ok()).toBeTruthy()

    await page.goto('/')
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 30_000 })
  })

  test('edit task flow: open edit modal, change title, save, see toast', async ({ page, request }) => {
    const title = `E2E edit task ${Date.now()}`
    const dueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    const created = await request.post('/api/tasks', {
      data: { title, status: 'todo', priority: 'normal', dueAt },
    })
    expect(created.ok()).toBeTruthy()

    await page.goto('/')
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 30_000 })

    const card = page.locator('article.task', { has: page.getByRole('heading', { name: title }) })
    await card.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('heading', { name: 'Edit task', exact: true })).toBeVisible()

    const updatedTitle = `${title} (edited)`
    await page.locator('#edit-title-input').fill(updatedTitle)
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Task updated.')).toBeVisible()
    await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible()
  })

  test('delete task flow: open delete modal, confirm, see toast', async ({ page, request }) => {
    const title = `E2E delete task ${Date.now()}`
    const dueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    const created = await request.post('/api/tasks', {
      data: { title, status: 'todo', priority: 'normal', dueAt },
    })
    expect(created.ok()).toBeTruthy()

    await page.goto('/')
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 30_000 })

    const card = page.locator('article.task', { has: page.getByRole('heading', { name: title }) })
    await card.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Delete task?')).toBeVisible()

    await page.getByRole('button', { name: 'Delete task' }).click()
    await expect(page.getByText('Task deleted.')).toBeVisible()
  })

  test('filters flow: open advanced filters and filter by status done', async ({ page }) => {
    const title = `E2E done task ${Date.now()}`
    const dueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    const created = await page.request.post('/api/tasks', {
      data: { title, status: 'done', priority: 'normal', dueAt },
    })
    expect(created.ok()).toBeTruthy()

    await page.goto('/')
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Toggle filters' }).click()
    await expect(page.getByRole('region', { name: 'Advanced filters and sorting' })).toBeVisible()

    await page.getByLabel('Filter by status').selectOption('done')
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })

  test('view mode toggle: Summary stays selected after switching to List and back', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Review case bundle', exact: true })).toBeVisible({ timeout: 30_000 })

    const summary = page.getByRole('button', { name: 'Summary', exact: true })
    const list = page.getByRole('button', { name: 'List', exact: true })

    await list.click()
    await expect(list).toHaveClass(/selected/)

    await summary.click()
    await expect(summary).toHaveClass(/selected/)
  })

  test('create modal opens from primary control', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create a new task' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create a new task' })).toBeVisible()
  })

  test('theme control toggles data-theme on the document root', async ({ page }) => {
    await page.goto('/')
    const toDark = page.getByRole('button', { name: 'Switch to dark mode' })
    await expect(toDark).toBeVisible()
    await toDark.click()
    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: 'Switch to light mode' }).click()
    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'light')
  })
})
