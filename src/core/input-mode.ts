/** Navigation vs Edit mode state machine for input components. */

export type InputMode = "navigation" | "editing";

export class InputModeManager {
  private _mode: InputMode = "navigation";
  private _editingId: string | null = null;

  get mode(): InputMode {
    return this._mode;
  }

  get editingId(): string | null {
    return this._editingId;
  }

  get isEditing(): boolean {
    return this._mode === "editing";
  }

  get isNavigating(): boolean {
    return this._mode === "navigation";
  }

  /** Enter edit mode for a specific input. */
  enterEdit(inputId: string): void {
    this._mode = "editing";
    this._editingId = inputId;
  }

  /** Exit edit mode, return to navigation. */
  exitEdit(): void {
    this._mode = "navigation";
    this._editingId = null;
  }

  /** Reset to navigation mode. */
  reset(): void {
    this._mode = "navigation";
    this._editingId = null;
  }
}
