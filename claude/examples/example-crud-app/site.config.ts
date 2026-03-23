/**
 * CRUD App Example — Notes manager with persistent state.
 *
 * Demonstrates: createPersistentState, dynamic, computed, form,
 * textInput, textArea, button, radioGroup, searchInput, checkbox.
 */
import {
  defineSite,
  page,
  card,
  markdown,
  divider,
  spacer,
  form,
  textInput,
  textArea,
  button,
  radioGroup,
  searchInput,
  dynamic,
  createPersistentState,
  computed,
} from "terminaltui";
import type { ContentBlock } from "terminaltui";

// ─── State ────────────────────────────────────────────────

interface Note {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
}

const store = createPersistentState({
  path: ".terminaltui/notes.json",
  defaults: {
    notes: [] as Note[],
    nextId: 1,
    filter: "all" as "all" | "pinned" | "recent",
    sortBy: "newest" as "newest" | "oldest" | "alpha",
  },
});

// ─── Computed ─────────────────────────────────────────────

const filteredNotes = computed(() => {
  const notes = store.get("notes");
  const filter = store.get("filter");
  const sortBy = store.get("sortBy");

  let result = [...notes];

  // Filter
  if (filter === "pinned") result = result.filter(n => n.pinned);
  if (filter === "recent") {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    result = result.filter(n => new Date(n.createdAt).getTime() > oneWeekAgo);
  }

  // Sort
  if (sortBy === "newest") result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (sortBy === "oldest") result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (sortBy === "alpha") result.sort((a, b) => a.title.localeCompare(b.title));

  return result;
});

const stats = computed(() => {
  const notes = store.get("notes");
  return {
    total: notes.length,
    pinned: notes.filter((n: Note) => n.pinned).length,
  };
});

// ─── Site ─────────────────────────────────────────────────

export default defineSite({
  name: "Notes",
  tagline: "A persistent note-taking app",
  theme: "nord",
  borders: "rounded",
  animations: { boot: true, exitMessage: "Notes saved." },

  onNavigate: () => {
    filteredNotes.invalidate();
    stats.invalidate();
  },

  pages: [
    // ── Notes List ──────────────────────────────────
    page("notes", {
      title: "Notes",
      icon: "#",
      content: [
        // Search
        dynamic(() => {
          const notes = store.get("notes");
          return searchInput({
            id: "note-search",
            placeholder: "Search notes...",
            items: notes.map((n: Note) => ({
              label: n.title,
              value: String(n.id),
              keywords: [n.body.slice(0, 50)],
            })),
            action: "navigate",
            maxResults: 10,
          });
        }),

        spacer(),

        // Filter + Sort
        radioGroup({
          id: "filter",
          label: "Show",
          options: [
            { label: "All", value: "all" },
            { label: "Pinned", value: "pinned" },
            { label: "Recent (7 days)", value: "recent" },
          ],
          defaultValue: store.get("filter"),
          onChange: (v) => {
            store.set("filter", v as any);
            filteredNotes.invalidate();
          },
        }),

        spacer(),

        // Stats
        dynamic(() => {
          stats.invalidate();
          const s = stats.get();
          return markdown(`**${s.total}** notes · **${s.pinned}** pinned`);
        }),

        divider(),

        // Notes list
        dynamic(() => {
          filteredNotes.invalidate();
          const notes = filteredNotes.get();
          if (notes.length === 0) {
            return markdown("*No notes yet. Create one from the New Note page.*");
          }
          return notes.map((note: Note) =>
            card({
              title: (note.pinned ? "\u2605 " : "") + note.title,
              subtitle: note.createdAt.split("T")[0],
              body: note.body.length > 100 ? note.body.slice(0, 100) + "..." : note.body,
              action: {
                label: note.pinned ? "Unpin" : "Pin",
                onPress: () => {
                  store.update("notes", (prev: Note[]) =>
                    prev.map((n: Note) => n.id === note.id ? { ...n, pinned: !n.pinned } : n)
                  );
                  filteredNotes.invalidate();
                  stats.invalidate();
                  return { success: note.pinned ? "Unpinned" : "Pinned!" };
                },
              },
            })
          );
        }),
      ],
    }),

    // ── New Note ────────────────────────────────────
    page("new", {
      title: "New Note",
      icon: "+",
      content: [
        form({
          id: "new-note",
          onSubmit: async (data) => {
            const title = (data.title as string ?? "").trim();
            const body = (data.body as string ?? "").trim();
            if (!title) return { error: "Title is required" };

            store.update("notes", (prev: Note[]) => [
              {
                id: store.get("nextId"),
                title,
                body,
                pinned: false,
                createdAt: new Date().toISOString(),
              },
              ...prev,
            ]);
            store.update("nextId", (n: number) => n + 1);
            filteredNotes.invalidate();
            stats.invalidate();

            return { success: `Created: ${title}` };
          },
          fields: [
            textInput({
              id: "title",
              label: "Title",
              placeholder: "Note title",
              validate: (v) => v.trim() ? null : "Required",
            }),
            textArea({
              id: "body",
              label: "Content",
              rows: 6,
              placeholder: "Write your note...",
            }),
            button({ label: "Create Note", style: "primary" }),
          ],
        }),
      ],
    }),

    // ── Manage ──────────────────────────────────────
    page("manage", {
      title: "Manage",
      icon: "~",
      content: [
        markdown("## Bulk Actions"),
        spacer(),

        dynamic(() => {
          stats.invalidate();
          const s = stats.get();
          if (s.total === 0) return markdown("*No notes to manage.*");
          return [
            markdown(`**${s.total}** notes stored on disk.`),
            spacer(),
            button({
              label: "Unpin All",
              style: "secondary",
              onPress: () => {
                store.update("notes", (prev: Note[]) =>
                  prev.map((n: Note) => ({ ...n, pinned: false }))
                );
                filteredNotes.invalidate();
                stats.invalidate();
                return { success: "All notes unpinned" };
              },
            }),
            spacer(),
            button({
              label: "Delete All Notes",
              style: "danger",
              onPress: () => {
                const count = store.get("notes").length;
                store.set("notes", []);
                store.set("nextId", 1);
                filteredNotes.invalidate();
                stats.invalidate();
                return { success: `Deleted ${count} notes` };
              },
            }),
          ] as ContentBlock[];
        }),
      ],
    }),

    // ── About ───────────────────────────────────────
    page("about", {
      title: "About",
      icon: "i",
      content: [
        markdown(`## Notes App

A persistent note-taking app built with terminaltui.

**Features demonstrated:**
- **createPersistentState()** — notes saved to \`.terminaltui/notes.json\`
- **dynamic()** — note list re-renders on every change
- **computed()** — filtered/sorted list + stats derive from state
- **form()** — create new notes with validation
- **searchInput()** — fuzzy search through notes
- **radioGroup()** with **onChange** — filter by all/pinned/recent
- **card()** with **action.onPress** — pin/unpin notes
- **button()** with **ActionResult** — feedback notifications

Quit and relaunch — your notes will still be there.`),
      ],
    }),
  ],
});
