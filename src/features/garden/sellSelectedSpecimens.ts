export interface MultiSaleResult {
  sold: Set<string>
  failed: Set<string>
  unconfirmed: Set<string>
}

/** Execute existing single-specimen actions without losing earlier successes. */
export async function sellSelectedSpecimens(
  ids: readonly string[],
  sell: (id: string) => Promise<boolean>,
): Promise<MultiSaleResult> {
  const result: MultiSaleResult = { sold: new Set(), failed: new Set(), unconfirmed: new Set() }
  for (const id of new Set(ids)) {
    try {
      ;(await sell(id) ? result.sold : result.failed).add(id)
    } catch {
      // A lost response is not proof that a transaction failed to commit.
      result.unconfirmed.add(id)
    }
  }
  return result
}
