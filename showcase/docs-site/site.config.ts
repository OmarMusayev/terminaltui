import {
  defineSite,
  page,
  card,
  link,
  markdown,
  accordion,
  timeline,
  divider,
  spacer,
} from "../../src/index.js";

export default defineSite({
  name: "FastDB",
  tagline: "Embedded database for the modern stack",
  banner: {
    text: "FASTDB",
    font: "Sub-Zero",
  },
  theme: "hacker",
  borders: "single",
  animations: {
    transitions: "fade",
    exitMessage: "$ fastdb.close() — connection terminated.",
  },
  pages: [
    page("getting-started", {
      title: "Getting Started",
      icon: ">",
      content: [
        card({
          title: "What is FastDB?",
          subtitle: "Embedded document database for Node.js and Bun",
          body: "Store JSON documents on disk with automatic indexing, ACID transactions, and zero external dependencies. Think SQLite, but for documents. 47 KB minified, zero deps, 100k inserts/sec.",
          tags: ["embedded", "document-db", "zero-config"],
        }),
        spacer(),
        accordion([
          {
            label: "Step 1 — Install FastDB",
            content: [
              markdown(`
Install FastDB from npm:

\`\`\`
npm install fastdb
\`\`\`

FastDB has **zero dependencies** and works with Node.js 18+, Bun, and Deno.
              `),
            ],
          },
          {
            label: "Step 2 — Import the module",
            content: [
              markdown(`
\`\`\`
import { FastDB } from 'fastdb';
\`\`\`

FastDB ships with full TypeScript declarations. CommonJS (\`require\`) is also supported.
              `),
            ],
          },
          {
            label: "Step 3 — Create a database instance",
            content: [
              markdown(`
\`\`\`
const db = new FastDB('./data.fdb');
\`\`\`

Pass a file path to create or open a database. Parent directories are created automatically. The \`.fdb\` extension is conventional but not required.
              `),
            ],
          },
          {
            label: "Step 4 — Insert your first document",
            content: [
              markdown(`
\`\`\`
const { id } = await db.insert({
  name: 'Alice',
  age: 30,
  tags: ['admin', 'active']
});
\`\`\`

Documents are plain JavaScript objects. Nested objects and arrays are supported. Each document receives an auto-generated UUID v7 as its \`id\`.
              `),
            ],
          },
          {
            label: "Step 5 — Query documents",
            content: [
              markdown(`
\`\`\`
const results = await db.find({ name: 'Alice' });
\`\`\`

Supports equality, \`$gt\`, \`$lt\`, \`$gte\`, \`$lte\`, \`$in\`, \`$regex\`, \`$exists\`, and \`$not\` operators. Add \`{ sort, limit, skip }\` as a second argument for pagination.
              `),
            ],
          },
          {
            label: "Step 6 — Create an index",
            content: [
              markdown(`
\`\`\`
await db.createIndex('name');
await db.createIndex('email', { unique: true });
\`\`\`

B+ tree indexes accelerate queries on the indexed field. Indexes persist across restarts. Supports dot notation for nested fields (\`"address.city"\`).
              `),
            ],
          },
          {
            label: "Step 7 — Run your application",
            content: [
              markdown(`
\`\`\`
node app.js
\`\`\`

FastDB runs embedded in your process — no server to start, no connection strings, no Docker containers. Just run your app.
              `),
            ],
          },
          {
            label: "Step 8 — Verify setup",
            content: [
              markdown(`
Check that the data directory was created and contains your \`.fdb\` file. You can inspect it with the **fastdb-studio** GUI:

\`\`\`
npx fastdb-studio ./data.fdb
\`\`\`

Open \`http://localhost:4040\` to browse your documents.
              `),
            ],
          },
        ]),
        spacer(),
        card({
          title: "Why FastDB?",
          subtitle: "Zero config, embedded, and fast",
          body: "No server to install. No connection strings. Lives in your process with no network overhead. B+ tree indexes, memory-mapped I/O, and a write-ahead log deliver 100k inserts/sec on commodity hardware.",
          tags: ["fast", "embedded", "ACID"],
        }),
        card({
          title: "When to Use FastDB",
          subtitle: "Ideal for local-first apps and small services",
          body: "Perfect for CLI tools, Electron apps, prototypes, and small-to-medium services that need persistent storage without ops burden. Handles databases up to ~10 GB. For multi-process writes or larger datasets, consider PostgreSQL.",
          tags: ["local-first", "CLI", "Electron"],
        }),
        spacer(),
        divider(),
        link("GitHub Repository", "https://github.com/fastdb/fastdb", {
          icon: "★",
        }),
        link("npm Package", "https://www.npmjs.com/package/fastdb", {
          icon: "↓",
        }),
        link("Full Documentation", "https://fastdb.dev/docs", { icon: "→" }),
      ],
    }),

    page("api", {
      title: "API Reference",
      icon: "#",
      content: [
        accordion([
          {
            label: "db.insert(doc)",
            content: [
              markdown(`
**Insert a document into the database.**

\`\`\`
await db.insert(document: object): Promise<{ id: string }>
\`\`\`

**Parameters:**
- \`document\` — A plain JavaScript object. Nested objects and arrays are supported. Functions and circular references are rejected.

**Returns:** An object containing the auto-generated \`id\` string (UUID v7).

**Throws:** \`ValidationError\` if the document contains unsupported types.

**Example:**
\`\`\`
const { id } = await db.insert({
  name: "Alice",
  email: "alice@example.com",
  tags: ["admin", "active"]
});
\`\`\`
              `),
            ],
          },
          {
            label: "db.find(query, options?)",
            content: [
              markdown(`
**Query documents matching a filter.**

\`\`\`
await db.find(query: object, options?: FindOptions): Promise<object[]>
\`\`\`

**Parameters:**
- \`query\` — A filter object. Supports equality, \`$gt\`, \`$lt\`, \`$gte\`, \`$lte\`, \`$in\`, \`$regex\`, \`$exists\`, and \`$not\` operators.
- \`options.limit\` — Maximum number of documents to return.
- \`options.skip\` — Number of documents to skip (for pagination).
- \`options.sort\` — Object mapping field names to \`1\` (ascending) or \`-1\` (descending).

**Returns:** An array of matching documents, including their \`_id\` field.

**Example:**
\`\`\`
const users = await db.find(
  { age: { $gte: 18 }, tags: { $in: ["active"] } },
  { sort: { name: 1 }, limit: 10 }
);
\`\`\`
              `),
            ],
          },
          {
            label: "db.update(query, update)",
            content: [
              markdown(`
**Update documents matching a filter.**

\`\`\`
await db.update(query: object, update: object): Promise<{ modified: number }>
\`\`\`

**Parameters:**
- \`query\` — A filter object (same syntax as \`db.find\`).
- \`update\` — An update object. Supports \`$set\`, \`$unset\`, \`$inc\`, \`$push\`, and \`$pull\` operators. Plain objects perform a full replacement.

**Returns:** An object with \`modified\` count indicating how many documents were changed.

**Example:**
\`\`\`
await db.update(
  { email: "alice@example.com" },
  { $set: { role: "admin" }, $inc: { loginCount: 1 } }
);
\`\`\`
              `),
            ],
          },
          {
            label: "db.delete(query)",
            content: [
              markdown(`
**Delete documents matching a filter.**

\`\`\`
await db.delete(query: object): Promise<{ deleted: number }>
\`\`\`

**Parameters:**
- \`query\` — A filter object (same syntax as \`db.find\`). An empty object \`{}\` will delete all documents.

**Returns:** An object with \`deleted\` count indicating how many documents were removed.

**Throws:** \`SafetyError\` if query is empty and \`allowDeleteAll\` is not set to \`true\` in the database options.

**Example:**
\`\`\`
const { deleted } = await db.delete({ status: "inactive" });
console.log(\`Removed \${deleted} inactive users\`);
\`\`\`
              `),
            ],
          },
          {
            label: "db.createIndex(field, options?)",
            content: [
              markdown(`
**Create a B+ tree index on a field for faster queries.**

\`\`\`
await db.createIndex(field: string, options?: IndexOptions): Promise<void>
\`\`\`

**Parameters:**
- \`field\` — The field name to index. Supports dot notation for nested fields (e.g., \`"address.city"\`).
- \`options.unique\` — If \`true\`, enforces uniqueness on the field. Default: \`false\`.
- \`options.sparse\` — If \`true\`, documents missing the field are excluded from the index. Default: \`false\`.

**Notes:** Indexes persist across restarts. Creating an index on a field that already has one is a no-op. For compound indexes, pass an array of field names.

**Example:**
\`\`\`
await db.createIndex("email", { unique: true });
await db.createIndex("address.city");
\`\`\`
              `),
            ],
          },
          {
            label: "db.transaction(fn)",
            content: [
              markdown(`
**Execute multiple operations atomically.**

\`\`\`
await db.transaction(fn: (tx: Transaction) => Promise<void>): Promise<void>
\`\`\`

**Parameters:**
- \`fn\` — An async function receiving a \`Transaction\` object. The transaction object exposes \`insert\`, \`find\`, \`update\`, and \`delete\` methods with the same signatures as the database. If the function throws, all changes are rolled back.

**Notes:** Transactions use a write-ahead log for durability. Concurrent transactions are serialized. Nesting is not supported.

**Example:**
\`\`\`
await db.transaction(async (tx) => {
  const sender = await tx.find({ id: senderId });
  const receiver = await tx.find({ id: receiverId });
  await tx.update({ id: senderId }, { $inc: { balance: -100 } });
  await tx.update({ id: receiverId }, { $inc: { balance: 100 } });
});
\`\`\`
              `),
            ],
          },
          {
            label: "db.backup(path)",
            content: [
              markdown(`
**Create a consistent backup of the database.**

\`\`\`
await db.backup(path: string): Promise<{ size: number }>
\`\`\`

**Parameters:**
- \`path\` — Destination file path for the backup. Parent directories are created automatically.

**Returns:** An object with \`size\` in bytes of the backup file.

**Notes:** Backups are taken atomically using a snapshot of the WAL. The database remains fully available for reads and writes during backup. Backup files are valid FastDB databases and can be opened directly.

**Example:**
\`\`\`
const { size } = await db.backup('./backups/daily.fdb');
console.log(\`Backup complete: \${(size / 1024).toFixed(1)} KB\`);
\`\`\`
              `),
            ],
          },
          {
            label: "db.close()",
            content: [
              markdown(`
**Close the database and flush all pending writes.**

\`\`\`
await db.close(): Promise<void>
\`\`\`

**Parameters:** None.

**Notes:** Always call \`close()\` before your process exits to ensure all data is flushed to disk. After closing, any method call on the database instance will throw a \`ClosedError\`. Calling \`close()\` on an already-closed database is a no-op.

**Example:**
\`\`\`
process.on('SIGINT', async () => {
  await db.close();
  process.exit(0);
});
\`\`\`
              `),
            ],
          },
        ]),
        spacer(),
        divider(),
        link("Full TypeScript Definitions", "https://github.com/fastdb/fastdb/blob/main/types/index.d.ts", {
          icon: "◇",
        }),
        link("GitHub Repository", "https://github.com/fastdb/fastdb", {
          icon: "★",
        }),
      ],
    }),

    page("faq", {
      title: "FAQ",
      icon: "?",
      content: [
        accordion([
          {
            label: "How does FastDB compare to SQLite?",
            content: [
              markdown(`
SQLite is a relational database with SQL. FastDB is a document database with a JavaScript-native query API. If you need joins, complex aggregations, or SQL compatibility, use SQLite. If you want to store and query JSON documents with zero config, FastDB is simpler and faster for that use case.
              `),
            ],
          },
          {
            label: "Is FastDB safe for production?",
            content: [
              markdown(`
Yes. FastDB uses a write-ahead log (WAL) for crash recovery and fsync for durability. Data is never lost on power failure. It has been in production at companies processing 50M+ documents since v2.0. That said, it is an embedded database — it runs in a single process. For multi-server deployments, use a networked database.
              `),
            ],
          },
          {
            label: "What is the maximum database size?",
            content: [
              markdown(`
FastDB comfortably handles databases up to ~10 GB with good index coverage. Beyond that, query performance degrades on full scans. If you anticipate larger datasets, consider sharding across multiple FastDB instances or migrating to PostgreSQL.
              `),
            ],
          },
          {
            label: "Can multiple processes access the same database?",
            content: [
              markdown(`
No. FastDB uses file locks to prevent corruption from concurrent process access. If you need multi-process writes, use a client-server database like PostgreSQL or MongoDB. For read-only access from multiple processes, you can open the database in \`readOnly\` mode.
              `),
            ],
          },
          {
            label: "Does FastDB support TypeScript?",
            content: [
              markdown(`
Yes. FastDB ships with full TypeScript declarations. You can type your documents with generics: \`db.find<User>({ role: 'admin' })\` returns \`Promise<User[]>\`. All query operators are fully typed.
              `),
            ],
          },
          {
            label: "How do I migrate from MongoDB?",
            content: [
              markdown(`
FastDB's query syntax is intentionally similar to MongoDB's. Most simple queries (\`$gt\`, \`$lt\`, \`$in\`, \`$regex\`) work identically. Export your MongoDB collection as JSON with \`mongoexport\`, then use \`db.insert()\` in a loop. The main differences: no \`$lookup\` (joins), no aggregation pipeline, and \`_id\` is a UUID string instead of ObjectId.
              `),
            ],
          },
          {
            label: "What happens if my app crashes mid-write?",
            content: [
              markdown(`
FastDB uses a write-ahead log. Writes are recorded in the WAL before being applied to the main data file. On restart, FastDB replays any uncommitted WAL entries automatically. You will never see partial documents or corrupted state.
              `),
            ],
          },
          {
            label: "Can I use FastDB in the browser?",
            content: [
              markdown(`
Not directly. FastDB relies on file system APIs (fs, memory-mapped files). For browser storage, consider IndexedDB or libraries like Dexie.js. We are exploring a WASM build with an OPFS backend, but it is not available yet.
              `),
            ],
          },
          {
            label: "How do I run queries on nested fields?",
            content: [
              markdown(`
Use dot notation: \`db.find({ "address.city": "Portland" })\`. This works for queries, indexes, sorts, and update operators. Array elements can be accessed by index: \`"tags.0"\` matches the first element.
              `),
            ],
          },
          {
            label: "Is there a GUI for FastDB?",
            content: [
              markdown(`
The community-maintained **fastdb-studio** package provides a web-based GUI for browsing and editing documents. Install it with \`npx fastdb-studio ./data.fdb\` and open \`http://localhost:4040\`. There is also a VS Code extension in beta.
              `),
            ],
          },
        ]),
        spacer(),
        divider(),
        link("GitHub Discussions", "https://github.com/fastdb/fastdb/discussions", {
          icon: "◆",
        }),
        link("Discord Community", "https://discord.gg/fastdb", {
          icon: "●",
        }),
      ],
    }),

    page("changelog", {
      title: "Changelog",
      icon: "!",
      content: [
        timeline([
          {
            title: "v3.2",
            period: "March 2026",
            subtitle: "Latest Release",
            description:
              "Added compound indexes, $regex operator with index acceleration, and db.explain() for query plan inspection. Fixed WAL replay edge case on ext4 filesystems. 15% improvement to bulk insert throughput.",
          },
          {
            title: "v3.1",
            period: "January 2026",
            subtitle: "Performance Release",
            description:
              "Introduced memory-mapped I/O for read-heavy workloads, reducing read latency by 40%. Added sparse indexes, $exists operator, and configurable fsync intervals for write-heavy applications.",
          },
          {
            title: "v3.0",
            period: "October 2025",
            subtitle: "Major Release",
            description:
              "Complete storage engine rewrite with B+ tree indexes replacing the hash-based system. ACID transactions, online backups, and a new query planner. Breaking change: database files must be migrated with the fastdb-migrate tool.",
          },
          {
            title: "v2.1",
            period: "June 2025",
            subtitle: "Stability Release",
            description:
              "Fixed a data corruption bug triggered by concurrent reads during compaction. Added $in and $not query operators. Improved error messages for schema validation failures. Bun compatibility verified.",
          },
          {
            title: "v2.0",
            period: "February 2025",
            subtitle: "Major Release",
            description:
              "Introduced the write-ahead log for crash safety, automatic compaction, and the createIndex API. Doubled write throughput through batched fsync. First version deemed production-ready.",
          },
          {
            title: "v1.0",
            period: "September 2024",
            subtitle: "Initial Release",
            description:
              "First stable release of FastDB. Simple append-only storage with JSON serialization, basic find/insert/update/delete operations, and file-level locking. Aimed at prototyping and small projects.",
          },
        ]),
        spacer(),
        divider(),
        link("GitHub Releases", "https://github.com/fastdb/fastdb/releases", {
          icon: "★",
        }),
        link("npm Package", "https://www.npmjs.com/package/fastdb", {
          icon: "↓",
        }),
      ],
    }),
  ],
});
