/**
 * Narrows an entry (or a collection tree page) to the type of one blueprint. TypeScript doesn't
 * narrow a union on a nested property, so `entry.blueprint.handle === "landing"` alone doesn't
 * narrow `entry`:
 *
 * ```ts
 * if (isBlueprint(entry, "landing")) entry.show_hero;
 * ```
 */
export function isBlueprint<T extends { blueprint: { handle: string } }, H extends T["blueprint"]["handle"]>(
  item: T,
  handle: H,
): item is Extract<T, { blueprint: { handle: H } }> {
  return item.blueprint.handle === handle;
}
