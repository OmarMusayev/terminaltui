/**
 * Form handling, page select actions, and button/card interactions
 * extracted from TUIRuntime.
 */
import type {
  ContentBlock, ButtonBlock, FormBlock, SelectBlock,
  RadioGroupBlock, TextInputBlock, TextAreaBlock,
} from "../config/types.js";
import type { FocusItem } from "./runtime-types.js";
import { collectFormFieldIds, getInputDefault } from "../components/Form.js";
import { openUrl } from "../helpers/open-url.js";

// Minimal runtime interface for form handling functions
interface RT {
  site: any;
  router: any;
  inputMode: any;
  pageFocusIndex: number;
  pageFocusItems: FocusItem[];
  inputStates: Map<string, any>;
  formResults: Map<string, { message: string; type: "success" | "error" | "info" }>;
  buttonLoading: Map<string, boolean>;
  notifications: any;
  formRegistry: Map<string, FormBlock>;
  accordionState: Map<string, number>;
  tabState: Map<string, number>;
  isServeMode: boolean;
  render(): void;
  getInputState(id: string, defaultValue?: any): any;
  showFeedback(msg: string): void;
  navigateToPage(pageId: string, params?: any): void;
  pageFocusNext(): void;
}

/** Handle enter/select on the currently focused item. */
export function handlePageSelect(rt: RT): void {
  const item = rt.pageFocusItems[rt.pageFocusIndex];
  if (!item) return;

  if (item.kind === "accordion-item") {
    const acc = item.accordion;
    const accKey = acc.items.map((i: any) => i.label).join(",");
    const current = rt.accordionState.get(accKey) ?? -1;
    rt.accordionState.set(accKey, current === item.itemIndex ? -1 : item.itemIndex);
    return;
  }

  if (item.kind === "timeline-item") {
    return;
  }

  const block = item.block;

  // Input components: Enter starts edit mode
  if (block.type === "textInput" || block.type === "textArea" ||
      block.type === "numberInput" || block.type === "searchInput") {
    const id = (block as any).id;
    rt.inputMode.enterEdit(id);
    rt.getInputState(id, getInputDefault(block));
    return;
  }

  if (block.type === "select") {
    const id = (block as SelectBlock).id;
    const state = rt.getInputState(id, (block as SelectBlock).defaultValue ?? "");
    rt.inputMode.enterEdit(id);
    state.open = true;
    const idx = (block as SelectBlock).options.findIndex((o: any) => o.value === state.value);
    state.highlightIndex = idx >= 0 ? idx : 0;
    return;
  }

  if (block.type === "radioGroup") {
    const id = (block as RadioGroupBlock).id;
    const state = rt.getInputState(id, (block as RadioGroupBlock).defaultValue ?? "");
    rt.inputMode.enterEdit(id);
    const idx = (block as RadioGroupBlock).options.findIndex((o: any) => o.value === state.value);
    state.highlightIndex = idx >= 0 ? idx : 0;
    return;
  }

  // Checkbox / Toggle: toggle directly
  if (block.type === "checkbox" || block.type === "toggle") {
    const id = (block as any).id;
    const state = rt.getInputState(id, (block as any).defaultValue ?? false);
    state.value = !state.value;
    (block as any).onChange?.(state.value);
    return;
  }

  // Button
  if (block.type === "button") {
    handleButtonPress(rt, block as ButtonBlock);
    return;
  }

  // Links
  if (block.type === "link") {
    if (rt.isServeMode) {
      rt.showFeedback(`URL: ${block.url}`);
    } else {
      rt.showFeedback(`Opening ${block.url}...`);
      openUrl(block.url).catch(() => {});
    }
    return;
  }

  // Cards
  if (block.type === "card" && block.url) {
    if (rt.isServeMode) {
      rt.showFeedback(`URL: ${block.url}`);
    } else {
      rt.showFeedback(`Opening ${block.url}...`);
      openUrl(block.url).catch(() => {});
    }
    return;
  }

  if (block.type === "card" && block.action) {
    handleCardAction(rt, block);
    return;
  }

  // Tabs
  if (block.type === "tabs") {
    const tabKey = block.items.map((i: any) => i.label).join(",");
    const current = rt.tabState.get(tabKey) ?? 0;
    rt.tabState.set(tabKey, (current + 1) % block.items.length);
    return;
  }

  // Hero CTA
  if (block.type === "hero" && block.cta?.url) {
    if (rt.isServeMode) {
      rt.showFeedback(`URL: ${block.cta.url}`);
    } else {
      rt.showFeedback(`Opening ${block.cta.url}...`);
      openUrl(block.cta.url).catch(() => {});
    }
    return;
  }
}

/** Handle a button press (submit form or run onPress). */
export function handleButtonPress(rt: RT, button: ButtonBlock): void {
  if (button._formId) {
    submitForm(rt, button._formId);
    return;
  }

  if (button.onPress) {
    const result = button.onPress();
    if (result && typeof (result as any).then === "function") {
      const btnKey = button.label;
      rt.buttonLoading.set(btnKey, true);
      rt.render();
      (result as Promise<any>).then((actionResult: any) => {
        rt.buttonLoading.delete(btnKey);
        showActionResult(rt, actionResult);
        rt.render();
      }).catch((err: any) => {
        rt.buttonLoading.delete(btnKey);
        rt.notifications.error(err instanceof Error ? err.message : String(err));
        rt.render();
      });
    } else if (result) {
      showActionResult(rt, result);
      rt.render();
    } else {
      rt.render();
    }
  }
}

/** Handle a card action (navigate or onPress). */
export function handleCardAction(rt: RT, card: ContentBlock & { type: "card" }): void {
  if (!card.action) return;

  if (card.action.navigate) {
    rt.navigateToPage(card.action.navigate, card.action.params);
    return;
  }

  if (card.action.confirm) {
    rt.showFeedback("Action triggered");
  }

  if (!card.action.onPress) return;
  const result = card.action.onPress();
  if (result && typeof (result as any).then === "function") {
    (result as Promise<void>).then(() => rt.render()).catch(() => rt.render());
  }
}

/** Show a notification from an ActionResult. */
function showActionResult(rt: RT, result: any): void {
  if (!result || typeof result !== "object") return;
  if ("success" in result) rt.notifications.success(result.success);
  else if ("error" in result) rt.notifications.error(result.error);
  else if ("info" in result) rt.notifications.info(result.info);
}

/** Validate an input block. Returns true if valid. */
export function validateInput(rt: RT, block: ContentBlock): boolean {
  if (block.type === "textInput") {
    const b = block as TextInputBlock;
    if (b.validate) {
      const state = rt.getInputState(b.id, b.defaultValue ?? "");
      const error = b.validate(state.value as string);
      state.error = error;
      return error === null;
    }
  } else if (block.type === "textArea") {
    const b = block as TextAreaBlock;
    if (b.validate) {
      const state = rt.getInputState(b.id, b.defaultValue ?? "");
      const error = b.validate(state.value as string);
      state.error = error;
      return error === null;
    }
  }
  return true;
}

/** Submit a form by ID. */
export async function submitForm(rt: RT, formId: string): Promise<void> {
  const formBlock = rt.formRegistry.get(formId);
  if (!formBlock) return;

  const fieldIds = collectFormFieldIds(formBlock.fields);
  let firstInvalidIdx = -1;

  for (let i = 0; i < formBlock.fields.length; i++) {
    const field = formBlock.fields[i];
    if (!validateInput(rt, field)) {
      if (firstInvalidIdx < 0) firstInvalidIdx = i;
    }
  }

  if (firstInvalidIdx >= 0) {
    const invalidField = formBlock.fields[firstInvalidIdx];
    const invalidId = (invalidField as any).id;
    if (invalidId) {
      for (let i = 0; i < rt.pageFocusItems.length; i++) {
        const item = rt.pageFocusItems[i];
        if (item.kind === "block" && "id" in item.block && (item.block as any).id === invalidId) {
          rt.pageFocusIndex = i;
          break;
        }
      }
    }
    rt.render();
    return;
  }

  const data: Record<string, any> = {};
  for (const id of fieldIds) {
    const state = rt.inputStates.get(id);
    data[id] = state?.value ?? undefined;
  }

  const btnField = formBlock.fields.find((f: any) => f.type === "button");
  const btnKey = btnField ? (btnField as ButtonBlock).label : "";
  if (btnKey) rt.buttonLoading.set(btnKey, true);
  rt.render();

  try {
    const result = await formBlock.onSubmit(data);
    if (btnKey) rt.buttonLoading.delete(btnKey);

    if ("success" in result) {
      rt.formResults.set(formId, { message: result.success, type: "success" });
      rt.notifications.success(result.success);
      if (formBlock.resetOnSubmit) {
        resetFormFields(rt, formBlock);
      }
    } else if ("error" in result) {
      rt.formResults.set(formId, { message: result.error, type: "error" });
      rt.notifications.error(result.error);
    } else if ("info" in result) {
      rt.formResults.set(formId, { message: result.info, type: "info" });
      rt.notifications.info(result.info);
    }
  } catch (err) {
    if (btnKey) rt.buttonLoading.delete(btnKey);
    const msg = err instanceof Error ? err.message : "An error occurred";
    rt.formResults.set(formId, { message: msg, type: "error" });
    rt.notifications.error(msg);
  }

  rt.render();

  setTimeout(() => {
    rt.formResults.delete(formId);
    rt.render();
  }, 5000);
}

/** Reset all fields in a form to their default values. */
export function resetFormFields(rt: RT, formBlock: FormBlock): void {
  for (const field of formBlock.fields) {
    if ("id" in field && (field as any).type !== "button") {
      const id = (field as any).id;
      const defaultVal = getInputDefault(field);
      const state = rt.inputStates.get(id);
      if (state) {
        state.value = defaultVal;
        state.cursorPos = typeof defaultVal === "string" ? defaultVal.length : 0;
        state.error = null;
        state.open = false;
        state.highlightIndex = 0;
        state.scrollOffset = 0;
      }
    }
  }
}
