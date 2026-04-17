export async function runBoundedDeletes(
  ids: string[],
  deleteOne: (id: string) => Promise<void>,
  onError: (error: unknown) => void,
  maxConcurrency = 6,
): Promise<{ deletedIds: string[]; failed: number }> {
  const deletedIds: string[] = []
  let failed = 0
  const concurrency = Math.max(1, Math.min(maxConcurrency, ids.length || 1))

  const runDelete = async (id: string): Promise<void> => {
    try {
      await deleteOne(id)
      deletedIds.push(id)
    } catch (error) {
      failed++
      onError(error)
    }
  }

  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency)
    await Promise.all(batch.map((id) => runDelete(id)))
  }

  return { deletedIds, failed }
}
