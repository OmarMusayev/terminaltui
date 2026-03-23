/** Toast notification system for action feedback. */

export interface Notification {
  message: string;
  type: "success" | "error" | "info";
  createdAt: number;
  duration: number;
}

export class NotificationManager {
  private _notifications: Notification[] = [];

  get current(): Notification | null {
    this.prune();
    return this._notifications[0] ?? null;
  }

  get all(): Notification[] {
    this.prune();
    return [...this._notifications];
  }

  success(message: string, duration = 3000): void {
    this._notifications.push({ message, type: "success", createdAt: Date.now(), duration });
  }

  error(message: string, duration = 4000): void {
    this._notifications.push({ message, type: "error", createdAt: Date.now(), duration });
  }

  info(message: string, duration = 3000): void {
    this._notifications.push({ message, type: "info", createdAt: Date.now(), duration });
  }

  /** Remove expired notifications. Returns true if any were removed. */
  prune(): boolean {
    const now = Date.now();
    const before = this._notifications.length;
    this._notifications = this._notifications.filter(n => now - n.createdAt < n.duration);
    return this._notifications.length !== before;
  }

  clear(): void {
    this._notifications = [];
  }
}
