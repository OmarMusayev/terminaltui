import { eventBus } from "../core/events.js";

export class Router {
  private pages: string[] = [];
  private _currentPage: string = "";
  private history: string[] = [];

  get currentPage(): string {
    return this._currentPage;
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

  navigate(pageId: string): boolean {
    if (!this.pages.includes(pageId)) return false;

    this.history.push(this._currentPage);
    this._currentPage = pageId;
    eventBus.emit("navigate", { from: this.history[this.history.length - 1], to: pageId });
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
    this._currentPage = prev;
    eventBus.emit("navigate", { from, to: prev });
    return true;
  }

  home(): boolean {
    if (this._currentPage === "") return true; // already home
    this.history = [];
    this._currentPage = "";
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
