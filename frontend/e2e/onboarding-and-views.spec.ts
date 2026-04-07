import { expect, test } from '@playwright/test'

test.describe('onboarding and advanced view interactions', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('task-app-onboarding-auto-dismiss-v1', '1')
      } catch {
        /* ignore */
      }
    })
  })

  test('guided tour starts and highlights toolbar controls', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('button', { name: 'Start guided tour' }).click()

    await expect(page.locator('.tour-coach-panel')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Welcome', exact: true }).last()).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Toolbar', exact: true }).last()).toBeVisible()
    await expect(page.locator('[data-tour="toolbar"].onboarding-spotlight-target')).toBeVisible()
  })

  test('list view supports multi-select and bulk delete', async ({ page, request }) => {
    const stamp = Date.now()
    const dueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    const t1 = `E2E bulk list A ${stamp}`
    const t2 = `E2E bulk list B ${stamp}`

    for (const title of [t1, t2]) {
      const created = await request.post('/api/tasks', {
        data: { title, status: 'todo', priority: 'normal', dueAt },
      })
      expect(created.ok()).toBeTruthy()
    }

    await page.goto('/')
    await page.getByRole('button', { name: 'List', exact: true }).click()
    await page.getByRole('searchbox').fill(`E2E bulk list ${stamp}`)

    const rowA = page.locator('tr', { hasText: t1 })
    const rowB = page.locator('tr', { hasText: t2 })
    await rowA.locator('input[type="checkbox"]').check()
    await rowB.locator('input[type="checkbox"]').check()

    await page.getByRole('button', { name: 'Delete selected tasks' }).click()
    await expect(page.getByRole('heading', { name: /Delete \d+ tasks\?/ })).toBeVisible()
    await page.getByRole('button', { name: 'Delete tasks' }).click()
    await expect(page.getByText('tasks deleted.')).toBeVisible()
  })

  test('kanban view supports card interactions (open reader)', async ({ page, request }) => {
    const title = `E2E kanban interaction ${Date.now()}`
    const dueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    const created = await request.post('/api/tasks', {
      data: { title, status: 'todo', priority: 'normal', dueAt },
    })
    expect(created.ok()).toBeTruthy()

    await page.goto('/')
    await page.getByRole('searchbox').fill(title)
    await page.getByRole('button', { name: 'Kanban', exact: true }).click()

    const source = page.locator('article.kanban-task', { hasText: title }).first()
    await source.click()
    await expect(page.locator('[data-tour="task-reader"]')).toBeVisible()
  })
})
