import {
  runSiteTests, page, card, link, markdown, divider, spacer,
  section, list, accordion, timeline, themes,
} from "../emulator-harness.js";
import { writeFileSync } from "node:fs";

const config = {
  name: "FastDB Docs",
  tagline: "Documentation for the FastDB embedded database",
  theme: "monokai" as const,
  borders: "single" as const,
  pages: [
    page("gettingstarted", {
      title: "Getting Started",
      icon: "📘",
      content: [
        list([
          "Install FastDB: npm install fastdb",
          "Import the module: import { FastDB } from 'fastdb'",
          "Create a database instance: const db = new FastDB('./data')",
          "Insert a record: await db.insert({ name: 'Alice', age: 30 })",
          "Query records: const results = await db.find({ age: { $gt: 25 } })",
          "Update a record: await db.update({ name: 'Alice' }, { age: 31 })",
          "Delete a record: await db.delete({ name: 'Alice' })",
          "Close the connection: await db.close()",
        ], "ordered"),
        spacer(1),
        markdown(
          "## Overview\n\n" +
          "FastDB is an embedded document database for Node.js that stores data in local files. " +
          "It provides a MongoDB-like query API without requiring a separate database server.\n\n" +
          "### Key Features\n\n" +
          "- **Zero configuration** — no server, no setup, just a file path\n" +
          "- **ACID transactions** — full durability guarantees with write-ahead logging\n" +
          "- **Rich queries** — supports $gt, $lt, $in, $regex, nested field access, and aggregation\n" +
          "- **Indexes** — B-tree and hash indexes for fast lookups on any field\n" +
          "- **TypeScript first** — full type inference on queries and results\n" +
          "- **Small footprint** — 47KB minified, zero dependencies\n\n" +
          "FastDB is designed for CLI tools, Electron apps, serverless functions, and any use case " +
          "where you need a database but don't want to run a server."
        ),
      ],
    }),
    page("api", {
      title: "API Reference",
      icon: "📖",
      content: [
        accordion([
          {
            label:"new FastDB(path, options?)",
            content: [
              markdown(
                "Creates a new database instance.\n\n" +
                "**Parameters:**\n" +
                "- `path` (string) — Directory where data files are stored\n" +
                "- `options.compression` (boolean) — Enable zstd compression. Default: false\n" +
                "- `options.encryptionKey` (string) — AES-256 encryption key for at-rest encryption\n" +
                "- `options.maxFileSize` (number) — Max file size in bytes before rotation. Default: 64MB\n\n" +
                "**Returns:** FastDB instance\n\n" +
                "```\nconst db = new FastDB('./mydata', {\n  compression: true,\n  maxFileSize: 128 * 1024 * 1024\n});\n```"
              ),
            ],
          },
          {
            label:"db.insert(document)",
            content: [
              markdown(
                "Inserts a document into the database.\n\n" +
                "**Parameters:**\n" +
                "- `document` (object) — The document to insert. Must be JSON-serializable.\n\n" +
                "**Returns:** Promise<InsertResult> with the generated _id\n\n" +
                "Throws `DuplicateKeyError` if a unique index constraint is violated."
              ),
            ],
          },
          {
            label:"db.find(query, options?)",
            content: [
              markdown(
                "Queries documents matching the given filter.\n\n" +
                "**Parameters:**\n" +
                "- `query` (object) — MongoDB-style query filter\n" +
                "- `options.limit` (number) — Max results to return\n" +
                "- `options.skip` (number) — Number of results to skip\n" +
                "- `options.sort` (object) — Sort specification, e.g. { age: -1 }\n" +
                "- `options.projection` (object) — Fields to include/exclude\n\n" +
                "**Returns:** Promise<Document[]>"
              ),
            ],
          },
          {
            label:"db.update(query, update, options?)",
            content: [
              markdown(
                "Updates documents matching the query.\n\n" +
                "**Parameters:**\n" +
                "- `query` (object) — Filter to match documents\n" +
                "- `update` (object) — Update operations ($set, $inc, $push, $pull, $unset)\n" +
                "- `options.upsert` (boolean) — Insert if no match. Default: false\n" +
                "- `options.multi` (boolean) — Update all matches. Default: false\n\n" +
                "**Returns:** Promise<UpdateResult> with matchedCount and modifiedCount"
              ),
            ],
          },
          {
            label:"db.delete(query, options?)",
            content: [
              markdown(
                "Deletes documents matching the query.\n\n" +
                "**Parameters:**\n" +
                "- `query` (object) — Filter to match documents for deletion\n" +
                "- `options.multi` (boolean) — Delete all matches. Default: false\n\n" +
                "**Returns:** Promise<DeleteResult> with deletedCount"
              ),
            ],
          },
          {
            label:"db.createIndex(field, options?)",
            content: [
              markdown(
                "Creates an index on the specified field for faster queries.\n\n" +
                "**Parameters:**\n" +
                "- `field` (string) — The field to index. Supports dot notation for nested fields.\n" +
                "- `options.unique` (boolean) — Enforce uniqueness. Default: false\n" +
                "- `options.type` ('btree' | 'hash') — Index type. Default: 'btree'\n" +
                "- `options.sparse` (boolean) — Skip documents without the field. Default: false\n\n" +
                "**Returns:** Promise<void>"
              ),
            ],
          },
        ]),
      ],
    }),
    page("faq", {
      title: "FAQ",
      icon: "❓",
      content: [
        accordion([
          {
            label:"Is FastDB suitable for production use?",
            content: [
              markdown("Yes. FastDB has been used in production by over 2,000 projects. It provides ACID guarantees through write-ahead logging and has been stress-tested with databases up to 50GB and 100M documents."),
            ],
          },
          {
            label:"How does FastDB compare to SQLite?",
            content: [
              markdown("FastDB is a document database (like MongoDB), while SQLite is relational. If your data is naturally document-shaped (JSON objects), FastDB is simpler. If you need joins, foreign keys, or SQL, use SQLite."),
            ],
          },
          {
            label:"Can multiple processes access the same database?",
            content: [
              markdown("Yes, FastDB uses file locking to coordinate access between multiple processes. However, for best performance, we recommend a single writer process with multiple reader processes."),
            ],
          },
          {
            label:"What happens if my process crashes mid-write?",
            content: [
              markdown("FastDB uses a write-ahead log (WAL) to ensure atomicity. If a process crashes, the WAL is replayed on next startup to recover any uncommitted transactions. No data is lost."),
            ],
          },
          {
            label:"Does FastDB support encryption?",
            content: [
              markdown("Yes. Pass an `encryptionKey` option when creating the database instance. FastDB uses AES-256-GCM for at-rest encryption. Each document is encrypted individually, so partial reads are still fast."),
            ],
          },
          {
            label:"How do I back up a FastDB database?",
            content: [
              markdown("Simply copy the data directory. FastDB files are append-only, so copying during operation is safe. For consistent snapshots, use `db.snapshot()` which creates a point-in-time copy with a read lock."),
            ],
          },
          {
            label:"What are the size limits?",
            content: [
              markdown("Individual documents can be up to 16MB (configurable). The database itself has no hard size limit — it's been tested up to 50GB. Files are automatically rotated when they reach `maxFileSize`."),
            ],
          },
          {
            label:"Does FastDB work in the browser?",
            content: [
              markdown("Not directly, since it relies on Node.js file system APIs. However, there is a community-maintained `fastdb-indexeddb` adapter that provides the same API using IndexedDB as the storage backend."),
            ],
          },
        ]),
      ],
    }),
    page("changelog", {
      title: "Changelog",
      icon: "📋",
      content: [
        timeline([
          {
            date: "v3.2.0 — March 2026",
            title: "Aggregation Pipeline",
            description: "Added MongoDB-compatible aggregation pipeline with $match, $group, $sort, $project, and $lookup stages. Also includes new $text search operator with full-text indexing.",
          },
          {
            date: "v3.1.0 — January 2026",
            title: "Compression & Performance",
            description: "Added optional zstd compression (40-60% size reduction). Rewrote the B-tree implementation for 3x faster range queries. Fixed memory leak in long-running cursor iterations.",
          },
          {
            date: "v3.0.0 — October 2025",
            title: "TypeScript Rewrite",
            description: "Complete rewrite in TypeScript with full type inference on queries. Breaking: dropped Node 16 support, new minimum is Node 18. Migration guide available in docs.",
          },
          {
            date: "v2.5.0 — July 2025",
            title: "Encryption & Multi-Process",
            description: "Added AES-256-GCM at-rest encryption. Implemented file-level locking for safe multi-process access. New snapshot API for consistent backups.",
          },
          {
            date: "v2.0.0 — March 2025",
            title: "Initial Stable Release",
            description: "First stable release after 8 months of beta. Core features: CRUD operations, indexing, transactions, WAL-based durability. Zero dependencies, 47KB minified.",
          },
        ]),
      ],
    }),
  ],
};

const report = runSiteTests(config, "agent-9-docs-site");
writeFileSync("test-sites/docs-site/report.json", JSON.stringify(report, null, 2));

const p = report.tests_passed;
const f = report.tests_failed;
const b = report.bugs.length;
console.log(`\nAgent 9 — Docs Site (FastDB): ${p} passed, ${f} failed, ${b} bugs`);
if (report.bugs.length > 0) {
  for (const bug of report.bugs) console.log(`  [${bug.severity}] ${bug.title}`);
}
if (f > 0) {
  console.log("\nFailed tests:");
  console.log(report.notes);
}
