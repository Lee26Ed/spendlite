import type { AppData, Transaction, TxType } from "./types"

/**
 * Every category the user has typed before (in transactions and plan items), de-duplicated
 * case-insensitively. Categories used with `type` come first, then by how often they're used.
 */
export function categorySuggestions(
    data: Pick<AppData, "transactions" | "plans">,
    type: TxType,
): string[] {
    const stats = new Map<
        string,
        { name: string; sameType: number; total: number }
    >()
    const add = (name: string, t: TxType) => {
        const clean = name.trim()
        if (!clean) return
        const key = clean.toLowerCase()
        const entry = stats.get(key) ?? { name: clean, sameType: 0, total: 0 }
        entry.total += 1
        if (t === type) entry.sameType += 1
        stats.set(key, entry)
    }
    for (const t of data.transactions) add(t.category, t.type)
    for (const p of data.plans) for (const i of p.items) add(i.category, i.type)
    return [...stats.values()]
        .sort(
            (a, b) =>
                Number(b.sameType > 0) - Number(a.sameType > 0) ||
                b.total - a.total ||
                a.name.localeCompare(b.name),
        )
        .map((e) => e.name)
}

/** Suggestions matching what has been typed: prefix matches first, then matches anywhere. */
export function matchCategories(
    options: string[],
    query: string,
    limit = 4,
): string[] {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, limit)
    const starts = options.filter((o) => o.toLowerCase().startsWith(q))
    const contains = options.filter(
        (o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q),
    )
    return [...starts, ...contains]
        .filter((o) => o.toLowerCase() !== q)
        .slice(0, limit)
}

export function allUsedCategories(txs: Transaction[]): string[] {
    return [...new Set(txs.map((t) => t.category).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
    )
}
