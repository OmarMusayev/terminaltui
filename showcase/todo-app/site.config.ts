/**
 * Todo App — Demonstrates reactive state, dynamic rendering, and persistent storage.
 *
 * Features used:
 *   - createPersistentState() — todos survive app restart
 *   - dynamic() — todo list re-renders automatically when state changes
 *   - computed() — derived counts update reactively
 *   - form + textInput + button — add new todos
 *   - radioGroup with onChange — filter todos
 *   - checkbox — toggle todo completion
 *   - card with action.onPress — delete todos
 */
import {
  defineSite,
  page,
  card,
  markdown,
  divider,
  spacer,
  section,
  form,
  textInput,
  button,
  radioGroup,
  dynamic,
  createPersistentState,
  computed,
} from "../../src/index.js";
import type { ContentBlock } from "../../src/index.js";

// ─── State ────────────────────────────────────────────────

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

const store = createPersistentState({
  path: ".terminaltui/todo-state.json",
  defaults: {
    todos: [] as Todo[],
    filter: "all" as "all" | "active" | "done",
    nextId: 1,
  },
});

// ─── Derived State ────────────────────────────────────────

const filteredTodos = computed(() => {
  const todos = store.get("todos");
  const filter = store.get("filter");
  if (filter === "active") return todos.filter((t: Todo) => !t.done);
  if (filter === "done") return todos.filter((t: Todo) => t.done);
  return todos;
});

const stats = computed(() => {
  const todos = store.get("todos");
  const total = todos.length;
  const done = todos.filter((t: Todo) => t.done).length;
  const active = total - done;
  return { total, done, active };
});

// ─── Site Config ──────────────────────────────────────────

export default defineSite({
  name: "Todo App",
  tagline: "A reactive todo list with persistent storage",
  theme: "tokyoNight",
  borders: "rounded",
  animations: { boot: true, exitMessage: "Todos saved. See you later!" },

  onNavigate: (from, to) => {
    // Invalidate computed values on navigation so they recalculate
    filteredTodos.invalidate();
    stats.invalidate();
  },

  pages: [
    page("todos", {
      title: "Todos",
      icon: "✓",
      content: [
        // ── Add Todo Form ──
        form({
          id: "add-todo",
          onSubmit: async (data) => {
            const text = (data.text as string ?? "").trim();
            if (!text) return { error: "Enter a todo" };

            store.update("todos", (prev: Todo[]) => [
              ...prev,
              { id: store.get("nextId"), text, done: false },
            ]);
            store.update("nextId", (n: number) => n + 1);

            return { success: `Added: ${text}` };
          },
          fields: [
            textInput({
              id: "text",
              label: "New Todo",
              placeholder: "What needs to be done?",
              validate: (v) => v.trim() ? null : "Can't be empty",
            }),
            button({ label: "Add Todo", style: "primary" }),
          ],
        }),

        spacer(),

        // ── Filter ──
        radioGroup({
          id: "filter",
          label: "Show",
          options: [
            { label: "All", value: "all" },
            { label: "Active", value: "active" },
            { label: "Done", value: "done" },
          ],
          defaultValue: store.get("filter"),
          onChange: (value) => {
            store.set("filter", value as "all" | "active" | "done");
            filteredTodos.invalidate();
            stats.invalidate();
          },
        }),

        spacer(),

        // ── Stats (reactive) ──
        dynamic(() => {
          stats.invalidate();
          const s = stats.get();
          if (s.total === 0) {
            return markdown("No todos yet. Add one above!");
          }
          return markdown(
            `**${s.active}** active · **${s.done}** done · **${s.total}** total`
          );
        }),

        divider(),

        // ── Todo List (reactive) ──
        dynamic(() => {
          filteredTodos.invalidate();
          const todos = filteredTodos.get();
          if (todos.length === 0) {
            const filter = store.get("filter");
            if (filter === "active") return markdown("*All done! Nothing active.*");
            if (filter === "done") return markdown("*No completed todos yet.*");
            return markdown("*Empty list. Add your first todo!*");
          }
          return todos.map((todo: Todo) =>
            card({
              title: (todo.done ? "✓ " : "○ ") + todo.text,
              subtitle: todo.done ? "done" : "active",
              action: {
                label: todo.done ? "Mark active" : "Mark done",
                onPress: () => {
                  store.update("todos", (prev: Todo[]) =>
                    prev.map((t: Todo) =>
                      t.id === todo.id ? { ...t, done: !t.done } : t
                    )
                  );
                  filteredTodos.invalidate();
                  stats.invalidate();
                },
              },
            })
          );
        }),

        spacer(),

        // ── Clear Completed ──
        dynamic(() => {
          stats.invalidate();
          const s = stats.get();
          if (s.done === 0) return spacer(0) as ContentBlock;
          return button({
            label: `Clear ${s.done} Completed`,
            style: "danger",
            onPress: () => {
              const count = stats.get().done;
              store.update("todos", (prev: Todo[]) =>
                prev.filter((t: Todo) => !t.done)
              );
              filteredTodos.invalidate();
              stats.invalidate();
              return { success: `Cleared ${count} completed todo${count !== 1 ? "s" : ""}` };
            },
          });
        }),
      ],
    }),

    page("about", {
      title: "About",
      icon: "i",
      content: [
        markdown(`## Todo App

This app demonstrates the terminaltui reactive framework:

- **createPersistentState()** — your todos are saved to disk and survive restarts
- **dynamic()** — the todo list re-renders automatically when you add, toggle, or delete items
- **computed()** — the stats counter updates reactively
- **form + textInput** — add new todos
- **radioGroup with onChange** — filter between all/active/done
- **card with action** — toggle completion by pressing Enter on a todo
- **button with onPress** — clear completed todos

Try it: add some todos, mark them done, filter, quit with **q**, then re-launch — your todos will still be there.`),
        spacer(),
        markdown("Built with **terminaltui** — the Next.js of TUIs."),
      ],
    }),
  ],
});
