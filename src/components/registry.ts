/**
 * Component registry — maps block type strings to render functions.
 * Centralizes the type→renderer mapping that was previously a switch statement.
 */
import { componentRegistry } from "./base.js";
import { renderText } from "./Text.js";
import { renderCard } from "./Card.js";
import { renderTimeline } from "./Timeline.js";
import { renderProgressBar } from "./ProgressBar.js";
import { renderTable } from "./Table.js";
import { renderLink } from "./Link.js";
import { renderDivider } from "./Divider.js";
import { renderSpacer } from "./Spacer.js";
import { renderQuote } from "./Quote.js";
import { renderBadge } from "./Badge.js";
import { renderHero } from "./Hero.js";
import { renderList } from "./List.js";
import { renderImage } from "./Image.js";
import { renderAccordion } from "./Accordion.js";
import { renderTabs } from "./Tabs.js";
import { renderGallery } from "./Gallery.js";
import { renderTextInput } from "./TextInput.js";
import { renderTextArea } from "./TextArea.js";
import { renderSelect } from "./Select.js";
import { renderCheckbox } from "./Checkbox.js";
import { renderToggle } from "./Toggle.js";
import { renderRadioGroup } from "./RadioGroup.js";
import { renderNumberInput } from "./NumberInput.js";
import { renderSearchInput } from "./SearchInput.js";
import { renderButton } from "./Button.js";

// ─── Display components (not focusable) ──────────────────

componentRegistry.register("text", (block, ctx) =>
  renderText(block.content, ctx, block.style));

componentRegistry.register("list", (block, ctx) =>
  renderList(block.items, ctx, block.style));

componentRegistry.register("quote", (block, ctx) =>
  renderQuote(block.text, ctx, { attribution: block.attribution, style: block.style }));

componentRegistry.register("table", (block, ctx) =>
  renderTable(block.headers, block.rows, ctx));

componentRegistry.register("progressBar", (block, ctx) =>
  renderProgressBar(block.label, block.value, ctx, { max: block.max, showPercent: block.showPercent }));

componentRegistry.register("badge", (block, ctx) =>
  [renderBadge(block.text, ctx, { color: block.color, style: block.style })]);

componentRegistry.register("image", (block, ctx) =>
  renderImage(block.path, ctx, { width: block.width, mode: block.mode }));

componentRegistry.register("divider", (block, ctx) =>
  renderDivider(ctx, { style: block.style, label: block.label, color: block.color }));

componentRegistry.register("spacer", (block) =>
  renderSpacer(block.lines));

componentRegistry.register("custom", (block, ctx) =>
  block.render(ctx.width, ctx.theme));

// ─── Interactive components (focusable) ──────────────────

componentRegistry.register("card", (block, ctx) =>
  renderCard(block, ctx), true);

componentRegistry.register("link", (block, ctx) =>
  renderLink(block.label, block.url, ctx, { icon: block.icon }), true);

componentRegistry.register("hero", (block, ctx) =>
  renderHero(block, ctx), true);

componentRegistry.register("tabs", (_block, _ctx) =>
  [], true); // tabs rendered specially by runtime

componentRegistry.register("accordion", (_block, _ctx) =>
  [], true); // accordion rendered specially by runtime

componentRegistry.register("timeline", (block, ctx) =>
  renderTimeline(block.items, ctx, block.style));

componentRegistry.register("gallery", (block, ctx) =>
  renderGallery(block.items, ctx, { columns: block.columns }));

// ─── Input components (focusable) ────────────────────────

componentRegistry.register("textInput", (_block, _ctx) =>
  [], true); // rendered with state by runtime

componentRegistry.register("textArea", (_block, _ctx) =>
  [], true);

componentRegistry.register("select", (_block, _ctx) =>
  [], true);

componentRegistry.register("checkbox", (_block, _ctx) =>
  [], true);

componentRegistry.register("toggle", (_block, _ctx) =>
  [], true);

componentRegistry.register("radioGroup", (_block, _ctx) =>
  [], true);

componentRegistry.register("numberInput", (_block, _ctx) =>
  [], true);

componentRegistry.register("searchInput", (_block, _ctx) =>
  [], true);

componentRegistry.register("button", (_block, _ctx) =>
  [], true);

export { componentRegistry };
