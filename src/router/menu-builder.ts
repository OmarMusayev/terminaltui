/**
 * Auto-generates the home page menu from the route table and page metadata.
 * Follows the rules specified in the file-based routing spec.
 */
import type { Route, RouteTable, PageMetadata, AutoMenuItem, MenuConfig } from "./types.js";

/**
 * Build the menu from the route table, page metadata, and optional menu config.
 *
 * Auto-generation rules:
 * 1. Every .ts file directly inside pages/ → top-level menu item
 * 2. Directories with index.ts → top-level menu item (name from directory)
 * 3. Files inside subdirectories (non-index) are NOT top-level
 * 4. home.ts / root index.ts is always first
 * 5. layout.ts files are never menu items (already filtered by scanner)
 * 6. Files with metadata.hidden = true are excluded
 * 7. Dynamic route files ([param].ts) are excluded
 */
export function buildMenu(
  routeTable: RouteTable,
  metadata: Map<string, PageMetadata>,
  menuConfig?: MenuConfig,
): AutoMenuItem[] {
  // If manual items are specified, use them directly
  if (menuConfig?.items && menuConfig.items.length > 0) {
    return menuConfig.items.map((item, i) => ({
      label: item.label,
      page: item.page,
      icon: item.icon,
      order: i,
    }));
  }

  // Auto-generate from routes
  const items: AutoMenuItem[] = [];

  for (const route of routeTable.routes) {
    if (!isTopLevelMenuRoute(route)) continue;

    const meta = metadata.get(route.name);

    // Exclude hidden pages
    if (meta?.hidden) continue;

    // Apply exclusion list
    if (menuConfig?.exclude?.includes(route.name)) continue;

    const label = resolveMenuLabel(route, meta, menuConfig);
    const icon = resolveMenuIcon(route, meta, menuConfig);
    const order = resolveMenuOrder(route, meta);

    items.push({ label, page: route.name, icon, order });
  }

  // Sort: ordered items first (by order), then unordered (alphabetical)
  items.sort(menuSortComparator);

  // Apply manual reordering if specified
  if (menuConfig?.order) {
    return reorderMenu(items, menuConfig.order);
  }

  return items;
}

/**
 * Determine if a route should appear as a top-level menu item.
 */
function isTopLevelMenuRoute(route: Route): boolean {
  // Dynamic routes are excluded
  if (route.isDynamic) return false;

  // Root-level files (depth 0)
  if (route.depth === 0) return true;

  // Subdirectory index.ts files become top-level items
  if (route.isIndex && route.depth === 1) return true;

  return false;
}

/**
 * Resolve the menu label for a route.
 * Priority: menuConfig.labels → metadata.label → titlecased filename
 */
function resolveMenuLabel(
  route: Route,
  meta: PageMetadata | undefined,
  menuConfig?: MenuConfig,
): string {
  // Check manual label override
  if (menuConfig?.labels?.[route.name]) {
    return menuConfig.labels[route.name];
  }

  // Check metadata label
  if (meta?.label) return meta.label;

  // Titlecase the filename/directory name
  const baseName = route.isIndex ? route.parentDir : route.name;
  // Handle nested paths — only use the last segment
  const lastSegment = baseName.split("/").pop() || baseName;
  return titleCase(lastSegment);
}

/**
 * Resolve the menu icon for a route.
 */
function resolveMenuIcon(
  route: Route,
  meta: PageMetadata | undefined,
  menuConfig?: MenuConfig,
): string | undefined {
  if (menuConfig?.icons?.[route.name]) {
    return menuConfig.icons[route.name];
  }
  return meta?.icon;
}

/**
 * Resolve the menu order for a route.
 * home is always 0, explicit order from metadata, otherwise Infinity for alphabetical.
 */
function resolveMenuOrder(route: Route, meta: PageMetadata | undefined): number {
  if (route.name === "home") return -Infinity;
  if (meta?.order !== undefined) return meta.order;
  return Infinity;
}

/**
 * Sort menu items: ordered first (by order value), then alphabetical.
 */
function menuSortComparator(a: AutoMenuItem, b: AutoMenuItem): number {
  // Both have explicit order
  if (a.order !== Infinity && b.order !== Infinity) {
    return a.order - b.order;
  }
  // Only a has order
  if (a.order !== Infinity) return -1;
  // Only b has order
  if (b.order !== Infinity) return 1;
  // Both unordered: alphabetical
  return a.label.localeCompare(b.label);
}

/**
 * Reorder menu items according to a specified order array.
 * Items in the order array come first (in that order), remaining items after.
 */
function reorderMenu(items: AutoMenuItem[], order: string[]): AutoMenuItem[] {
  const ordered: AutoMenuItem[] = [];
  const remaining: AutoMenuItem[] = [];

  for (const name of order) {
    const item = items.find(i => i.page === name);
    if (item) ordered.push(item);
  }

  for (const item of items) {
    if (!order.includes(item.page)) remaining.push(item);
  }

  return [...ordered, ...remaining];
}

/**
 * Convert a kebab-case or camelCase string to Title Case.
 * "about" → "About", "our-team" → "Our Team", "coffeeShop" → "Coffee Shop"
 */
export function titleCase(str: string): string {
  return str
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, c => c.toUpperCase());
}
