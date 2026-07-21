import { eventBus } from "../core/events.js";
import type { RouteParams } from "../router/types.js";

export class Router {
  private pages: string[] = [];
  private _currentPage: string = "";
  private _currentParams: RouteParams = {};
  private history: { page: string; params: RouteParams }[] = [];

  get currentPage(): string {
    return this._currentPage;
  }

  /** Params of the current navigation entry — restored by back(). */
  get currentParams(): RouteParams {
    return this._currentParams;
  }

  get currentIndex(): number {
    return this.pages.indexOf(this._currentPage);
  }

  get pageCount(): number {
    return this.pages.length;
  }

  registerPages(pageIds: string[]): void {
    this.pages = [...pageIds];
    // Don't auto-set currentPage — empty string means "home screen"
  }

  navigate(pageId: string, params?: RouteParams): boolean {
    if (!this.pages.includes(pageId)) return false;

    this.history.push({ page: this._currentPage, params: this._currentParams });
    this._currentPage = pageId;
    this._currentParams = params ?? {};
    eventBus.emit("navigate", { from: this.history[this.history.length - 1].page, to: pageId });
    return true;
  }

  navigateByIndex(index: number): boolean {
    if (index < 0 || index >= this.pages.length) return false;
    if (this._currentPage === this.pages[index]) return true;
    return this.navigate(this.pages[index]);
  }

  back(): boolean {
    if (this.history.length === 0) return false;
    const prev = this.history.pop()!;
    const from = this._currentPage;
    this._currentPage = prev.page;
    this._currentParams = prev.params ?? {};
    eventBus.emit("navigate", { from, to: prev.page });
    return true;
  }

  home(): boolean {
    if (this._currentPage === "") return true; // already home
    this.history = [];
    this._currentPage = "";
    this._currentParams = {};
    return true;
  }

  isHome(): boolean {
    return this._currentPage === "";
  }

  getPageId(index: number): string | undefined {
    return this.pages[index];
  }

  getAllPages(): string[] {
    return [...this.pages];
  }
}
