/**
 * terminaltui migrate — converts a single-file site.config.ts into
 * the multi-file file-based routing structure.
 *
 * Parses the existing config and generates:
 *   config.ts — theme, settings, global config
 *   pages/home.ts — home page (auto-generated if needed)
 *   pages/<pageName>.ts — one file per page
 *   api/<routeName>.ts — one file per API route
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { pathToFileURL } from "node:url";

interface MigrationResult {
  configFile: string;
  pageFiles: string[];
  apiFiles: string[];
  warnings: string[];
}

/**
 * Run the migration on a project directory.
 */
export async function migrateProject(projectDir: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    configFile: "",
    pageFiles: [],
    apiFiles: [],
    warnings: [],
  };

  // Find the existing site.config.ts
  const configPath = findSiteConfig(projectDir);
  if (!configPath) {
    throw new Error("No site.config.ts found in " + projectDir);
  }

  // Read the source file
  const source = readFileSync(configPath, "utf-8");

  // Parse the config structure from the source
  const parsed = parseSiteConfigSource(source);

  // Create output directories
  const pagesDir = join(projectDir, "pages");
  mkdirSync(pagesDir, { recursive: true });

  // Generate config.ts
  const configContent = generateConfigFile(parsed);
  const configOutPath = join(projectDir, "config.ts");
  writeFileSync(configOutPath, configContent, "utf-8");
  result.configFile = configOutPath;

  // Generate page files
  for (const page of parsed.pages) {
    const pageContent = generatePageFile(page, parsed.importPath);
    const pagePath = join(pagesDir, `${page.id}.ts`);
    writeFileSync(pagePath, pageContent, "utf-8");
    result.pageFiles.push(pagePath);
  }

  // Generate API route files
  if (parsed.apiRoutes.length > 0) {
    const apiDir = join(projectDir, "api");
    mkdirSync(apiDir, { recursive: true });

    for (const route of parsed.apiRoutes) {
      const apiContent = generateApiFile(route);
      const apiPath = join(apiDir, `${route.name}.ts`);
      writeFileSync(apiPath, apiContent, "utf-8");
      result.apiFiles.push(apiPath);
    }
  }

  return result;
}

interface ParsedSiteConfig {
  name: string;
  tagline?: string;
  handle?: string;
  theme?: string;
  borders?: string;
  banner?: string; // Raw source text for banner config
  animations?: string; // Raw source text
  navigation?: string;
  easterEggs?: string;
  footer?: string;
  statusBar?: string;
  artDir?: string;
  onInit?: string;
  onExit?: string;
  onNavigate?: string;
  onError?: string;
  pages: ParsedPage[];
  apiRoutes: ParsedApiRoute[];
  importPath: string; // "terminaltui" or relative path
  extraImports: string[];
}

interface ParsedPage {
  id: string;
  title: string;
  icon?: string;
  contentSource: string; // Raw source code for the content array
  imports: string[]; // Component imports needed
}

interface ParsedApiRoute {
  name: string;
  method: string;
  path: string;
  handlerSource: string;
}

/**
 * Parse the site.config.ts source to extract pages, config, and API routes.
 * This is a best-effort regex-based parser — not a full AST parser.
 */
function parseSiteConfigSource(source: string): ParsedSiteConfig {
  const result: ParsedSiteConfig = {
    name: "",
    pages: [],
    apiRoutes: [],
    importPath: "terminaltui",
    extraImports: [],
  };

  // Detect import path
  const importMatch = source.match(/from\s+["']([^"']+)["']/);
  if (importMatch) {
    result.importPath = importMatch[1];
  }

  // Extract imported components
  const importBlockMatch = source.match(/import\s*\{([^}]+)\}\s*from/);
  if (importBlockMatch) {
    result.extraImports = importBlockMatch[1]
      .split(",")
      .map(s => s.trim())
      .filter(s => s && s !== "defineSite" && s !== "page");
  }

  // Extract name
  const nameMatch = source.match(/name:\s*["']([^"']+)["']/);
  if (nameMatch) result.name = nameMatch[1];

  // Extract tagline
  const taglineMatch = source.match(/tagline:\s*["']([^"']+)["']/);
  if (taglineMatch) result.tagline = taglineMatch[1];

  // Extract handle
  const handleMatch = source.match(/handle:\s*["']([^"']+)["']/);
  if (handleMatch) result.handle = handleMatch[1];

  // Extract theme
  const themeMatch = source.match(/theme:\s*["']([^"']+)["']/);
  if (themeMatch) result.theme = themeMatch[1];

  // Extract borders
  const bordersMatch = source.match(/borders:\s*["']([^"']+)["']/);
  if (bordersMatch) result.borders = bordersMatch[1];

  // Extract raw blocks for complex configs
  result.banner = extractConfigBlock(source, "banner");
  result.animations = extractConfigBlock(source, "animations");

  // Extract pages using page() calls
  const pageRegex = /page\(\s*["']([^"']+)["']\s*,\s*\{/g;
  let pageMatch;

  while ((pageMatch = pageRegex.exec(source)) !== null) {
    const pageId = pageMatch[1];
    const startIdx = pageMatch.index;

    // Find the matching closing of the page() call
    const pageSource = extractBalancedBlock(source, startIdx);

    // Extract title
    const titleMatch = pageSource.match(/title:\s*["']([^"']+)["']/);
    const title = titleMatch ? titleMatch[1] : titleCase(pageId);

    // Extract icon
    const iconMatch = pageSource.match(/icon:\s*["']([^"']+)["']/);
    const icon = iconMatch ? iconMatch[1] : undefined;

    // Extract content array
    const contentMatch = pageSource.match(/content:\s*\[/);
    let contentSource = "[]";
    if (contentMatch) {
      const contentStart = pageSource.indexOf("content:") + 8;
      contentSource = extractBalancedBracket(pageSource, contentStart);
    }

    // Detect which imports this page needs
    const imports = detectImports(contentSource, result.extraImports);

    result.pages.push({
      id: pageId,
      title,
      icon,
      contentSource,
      imports,
    });
  }

  // Extract API routes
  const apiMatch = source.match(/api:\s*\{/);
  if (apiMatch) {
    const apiBlock = extractBalancedBrace(source, source.indexOf("api:") + 4);
    const routeRegex = /["'](\w+)\s+(\/[^"']+)["']\s*:\s*(async\s+)?\([^)]*\)\s*=>/g;
    let rMatch;
    while ((rMatch = routeRegex.exec(apiBlock)) !== null) {
      const method = rMatch[1];
      const path = rMatch[2];
      const name = path.split("/").pop()?.replace(/:/g, "") || "route";
      const handlerStart = rMatch.index;
      const handlerSource = extractApiHandler(apiBlock, handlerStart);

      result.apiRoutes.push({ name, method, path, handlerSource });
    }
  }

  return result;
}

/**
 * Generate the config.ts file content.
 */
function generateConfigFile(parsed: ParsedSiteConfig): string {
  const lines: string[] = [];
  lines.push(`import { defineConfig } from "terminaltui";`);
  lines.push("");
  lines.push("export default defineConfig({");
  lines.push(`  name: "${parsed.name}",`);

  if (parsed.tagline) lines.push(`  tagline: "${parsed.tagline}",`);
  if (parsed.handle) lines.push(`  handle: "${parsed.handle}",`);
  if (parsed.theme) lines.push(`  theme: "${parsed.theme}",`);
  if (parsed.borders) lines.push(`  borders: "${parsed.borders}",`);
  if (parsed.banner) lines.push(`  banner: ${parsed.banner},`);
  if (parsed.animations) lines.push(`  animations: ${parsed.animations},`);

  lines.push("});");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate a page file from a parsed page.
 */
function generatePageFile(page: ParsedPage, importPath: string): string {
  const lines: string[] = [];

  // Imports
  const imports = page.imports.filter(i => i !== "defineSite" && i !== "page");
  if (imports.length > 0) {
    lines.push(`import { ${imports.join(", ")} } from "terminaltui";`);
    lines.push("");
  }

  // Metadata
  const metaParts: string[] = [];
  if (page.title) metaParts.push(`label: "${page.title}"`);
  if (page.icon) metaParts.push(`icon: "${page.icon}"`);
  if (metaParts.length > 0) {
    lines.push(`export const metadata = { ${metaParts.join(", ")} };`);
    lines.push("");
  }

  // Page function
  const fnName = toPascalCase(page.id);
  lines.push(`export default function ${fnName}() {`);
  lines.push(`  return ${page.contentSource};`);
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate an API route file.
 */
function generateApiFile(route: ParsedApiRoute): string {
  const lines: string[] = [];
  lines.push(`export async function ${route.method}(request: { params: Record<string, string>; body: any; query: Record<string, string> }) {`);
  lines.push(`  ${route.handlerSource}`);
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

// ─── Helpers ──────────────────────────────────────────────

function findSiteConfig(dir: string): string | null {
  for (const name of ["site.config.ts", "site.config.js", "site.config.mjs"]) {
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

function extractConfigBlock(source: string, key: string): string | undefined {
  const match = source.match(new RegExp(`${key}:\\s*\\{`));
  if (!match) return undefined;
  return extractBalancedBrace(source, match.index! + key.length + 1).trim();
}

function extractBalancedBlock(source: string, startIdx: number): string {
  let depth = 0;
  let i = startIdx;
  let started = false;

  while (i < source.length) {
    if (source[i] === "(" || source[i] === "{" || source[i] === "[") {
      depth++;
      started = true;
    }
    if (source[i] === ")" || source[i] === "}" || source[i] === "]") {
      depth--;
      if (started && depth === 0) return source.slice(startIdx, i + 1);
    }
    i++;
  }
  return source.slice(startIdx);
}

function extractBalancedBracket(source: string, startIdx: number): string {
  let depth = 0;
  let i = startIdx;
  const start = source.indexOf("[", i);
  if (start === -1) return "[]";
  i = start;

  while (i < source.length) {
    if (source[i] === "[") depth++;
    if (source[i] === "]") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
    i++;
  }
  return source.slice(start);
}

function extractBalancedBrace(source: string, startIdx: number): string {
  let depth = 0;
  let i = startIdx;
  const start = source.indexOf("{", i);
  if (start === -1) return "{}";
  i = start;

  while (i < source.length) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
    i++;
  }
  return source.slice(start);
}

function extractApiHandler(source: string, startIdx: number): string {
  // Find the arrow function body
  const arrowIdx = source.indexOf("=>", startIdx);
  if (arrowIdx === -1) return "return {};";

  const afterArrow = source.slice(arrowIdx + 2).trim();
  if (afterArrow.startsWith("{")) {
    return extractBalancedBrace(source, arrowIdx + 2);
  }
  // Single-expression arrow
  const endIdx = source.indexOf(",\n", arrowIdx);
  if (endIdx === -1) return afterArrow.slice(0, 100);
  return "return " + source.slice(arrowIdx + 2, endIdx).trim() + ";";
}

function detectImports(contentSource: string, available: string[]): string[] {
  return available.filter(imp => {
    // Check if this import name appears in the content as a function call
    const regex = new RegExp(`\\b${imp}\\s*[({]`);
    return regex.test(contentSource);
  });
}

function titleCase(str: string): string {
  return str.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s/g, "");
}
