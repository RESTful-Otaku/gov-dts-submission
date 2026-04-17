import type { TaskPriority, TaskStatus, UserRole } from './api'

/** Single password for all seeded demo accounts (dev / staging / offline APK). */
export const DEMO_SEED_DEMO_PASSWORD = 'DemoPass123!'

/**
 * Argon2id hash of {@link DEMO_SEED_DEMO_PASSWORD} using `dts-seed-static-salt`
 * (matches `passwordHashForSeed` in backend `internal/seed/seed.go`).
 */
export const DEMO_SEED_PASSWORD_HASH =
  'ZHRzLXNlZWQtc3RhdGljLXNhbHQ.iksu6ZH6hbv9/hnscrqzw1U3oRvBKL3mi886+Ga8XQ0'

export interface DemoSeedUserRow {
  id: string
  email: string
  firstName: string
  lastName: string
  username: string
  role: UserRole
}

/** 20 accounts: 2 admins, 8 editors, 10 viewers — IDs align with Go `DemoUsersWithDriver`. */
export const DEMO_SEED_USERS: DemoSeedUserRow[] = [
  { id: '10000000-0001-4000-8000-000000000001', email: 'admin@example.gov', firstName: 'Sarah', lastName: 'Chen', username: 'Sarah Chen', role: 'admin' },
  { id: '10000000-0001-4000-8000-000000000002', email: 'admin.morgan@example.gov', firstName: 'Morgan', lastName: 'Blake', username: 'Morgan Blake', role: 'admin' },
  { id: '10000000-0001-4000-8000-000000000003', email: 'editor@example.gov', firstName: 'James', lastName: 'Wilson', username: 'James Wilson', role: 'editor' },
  { id: '10000000-0001-4000-8000-000000000004', email: 'editor.alex@example.gov', firstName: 'Alex', lastName: 'Rivera', username: 'Alex Rivera', role: 'editor' },
  { id: '10000000-0001-4000-8000-000000000005', email: 'editor.jordan@example.gov', firstName: 'Jordan', lastName: 'Matthews', username: 'Jordan Matthews', role: 'editor' },
  { id: '10000000-0001-4000-8000-000000000006', email: 'editor.casey@example.gov', firstName: 'Casey', lastName: 'Nguyen', username: 'Casey Nguyen', role: 'editor' },
  { id: '10000000-0001-4000-8000-000000000007', email: 'editor.riley@example.gov', firstName: 'Riley', lastName: 'Foster', username: 'Riley Foster', role: 'editor' },
  { id: '10000000-0001-4000-8000-000000000008', email: 'editor.sam@example.gov', firstName: 'Sam', lastName: 'Okonkwo', username: 'Sam Okonkwo', role: 'editor' },
  { id: '10000000-0001-4000-8000-000000000009', email: 'editor.taylor@example.gov', firstName: 'Taylor', lastName: 'Brooks', username: 'Taylor Brooks', role: 'editor' },
  { id: '10000000-0001-4000-8000-00000000000a', email: 'editor.quinn@example.gov', firstName: 'Quinn', lastName: 'Mitchell', username: 'Quinn Mitchell', role: 'editor' },
  { id: '10000000-0001-4000-8000-00000000000b', email: 'viewer@example.gov', firstName: 'Priya', lastName: 'Patel', username: 'Priya Patel', role: 'viewer' },
  { id: '10000000-0001-4000-8000-00000000000c', email: 'viewer.jamie@example.gov', firstName: 'Jamie', lastName: 'Chen', username: 'Jamie Chen', role: 'viewer' },
  { id: '10000000-0001-4000-8000-00000000000d', email: 'viewer.robin@example.gov', firstName: 'Robin', lastName: 'Ellis', username: 'Robin Ellis', role: 'viewer' },
  { id: '10000000-0001-4000-8000-00000000000e', email: 'viewer.dana@example.gov', firstName: 'Dana', lastName: 'Singh', username: 'Dana Singh', role: 'viewer' },
  { id: '10000000-0001-4000-8000-00000000000f', email: 'viewer.lee@example.gov', firstName: 'Lee', lastName: 'Garcia', username: 'Lee Garcia', role: 'viewer' },
  { id: '10000000-0001-4000-8000-000000000010', email: 'viewer.avery@example.gov', firstName: 'Avery', lastName: 'Moore', username: 'Avery Moore', role: 'viewer' },
  { id: '10000000-0001-4000-8000-000000000011', email: 'viewer.drew@example.gov', firstName: 'Drew', lastName: 'Thompson', username: 'Drew Thompson', role: 'viewer' },
  { id: '10000000-0001-4000-8000-000000000012', email: 'viewer.remy@example.gov', firstName: 'Remy', lastName: 'Clarke', username: 'Remy Clarke', role: 'viewer' },
  { id: '10000000-0001-4000-8000-000000000013', email: 'viewer.sky@example.gov', firstName: 'Sky', lastName: 'Patel', username: 'Sky Patel', role: 'viewer' },
  { id: '10000000-0001-4000-8000-000000000014', email: 'viewer.jordanf@example.gov', firstName: 'Jordan', lastName: 'Fox', username: 'Jordan Fox', role: 'viewer' },
]

export type DemoTaskSeedTemplate = {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  owner: string
  tags: string[]
  dueDays: number
}

const SUBJECTS = [
  'Bundle',
  'Hearing',
  'Disclosure',
  'Correspondence',
  'Listing',
  'Case review',
  'Directions',
  'Compliance',
  'Mediation',
  'Appeal prep',
]

const ADMIN_OWNERS = ['Sarah Chen', 'Morgan Blake']
const EDITOR_OWNERS = [
  'James Wilson',
  'Alex Rivera',
  'Jordan Matthews',
  'Casey Nguyen',
  'Riley Foster',
  'Sam Okonkwo',
  'Taylor Brooks',
  'Quinn Mitchell',
]

/** 120 demo tasks: first 12 owned by admins, remainder by editors (round-robin). */
export function buildDemoTaskTemplates(): DemoTaskSeedTemplate[] {
  const statuses: TaskStatus[] = ['todo', 'in_progress', 'done']
  const priorities: TaskPriority[] = ['low', 'normal', 'high', 'urgent']
  const out: DemoTaskSeedTemplate[] = []
  for (let i = 0; i < 120; i++) {
    const subject = SUBJECTS[i % SUBJECTS.length]!
    const n = i + 1
    const owner = i < 12 ? ADMIN_OWNERS[i % ADMIN_OWNERS.length]! : EDITOR_OWNERS[(i - 12) % EDITOR_OWNERS.length]!
    const tagSlug = subject.toLowerCase().replace(/\s+/g, '-')
    out.push({
      title: `${subject} — casework item ${n}`,
      description: `Demonstration task ${n} for dev/staging builds.`,
      status: statuses[i % 3]!,
      priority: priorities[i % 4]!,
      owner,
      tags: ['demo', 'seed', tagSlug],
      dueDays: (i % 90) + 1,
    })
  }
  return out
}
