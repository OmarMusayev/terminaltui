export class FocusManager {
  private items: string[] = [];
  private _focusIndex: number = 0;

  get focusedId(): string | undefined {
    return this.items[this._focusIndex];
  }

  get focusIndex(): number {
    return this._focusIndex;
  }

  set focusIndex(idx: number) {
    if (idx >= 0 && idx < this.items.length) {
      this._focusIndex = idx;
    }
  }

  setItems(itemIds: string[]): void {
    this.items = [...itemIds];
    if (this._focusIndex >= this.items.length) {
      this._focusIndex = Math.max(0, this.items.length - 1);
    }
  }

  focusNext(): string | undefined {
    if (this.items.length === 0) return undefined;
    this._focusIndex = (this._focusIndex + 1) % this.items.length;
    return this.items[this._focusIndex];
  }

  focusPrev(): string | undefined {
    if (this.items.length === 0) return undefined;
    this._focusIndex = (this._focusIndex - 1 + this.items.length) % this.items.length;
    return this.items[this._focusIndex];
  }

  focusFirst(): string | undefined {
    this._focusIndex = 0;
    return this.items[0];
  }

  focusLast(): string | undefined {
    this._focusIndex = Math.max(0, this.items.length - 1);
    return this.items[this._focusIndex];
  }

  isFocused(id: string): boolean {
    return this.items[this._focusIndex] === id;
  }

  get count(): number {
    return this.items.length;
  }
}
