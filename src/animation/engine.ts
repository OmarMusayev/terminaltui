export type AnimationFrame = (frame: number, totalFrames: number, elapsed: number) => void;

export interface Animation {
  id: string;
  totalFrames: number;
  onFrame: AnimationFrame;
  onComplete?: () => void;
  currentFrame: number;
}

export class AnimationEngine {
  private animations: Map<string, Animation> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;
  private fps = 30;
  private running = false;

  start(): void {
    if (this.running) return;
    this.running = true;
    const interval = Math.floor(1000 / this.fps);
    this.timer = setInterval(() => this.tick(), interval);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.animations.clear();
  }

  add(id: string, totalFrames: number, onFrame: AnimationFrame, onComplete?: () => void): void {
    this.animations.set(id, {
      id,
      totalFrames,
      onFrame,
      onComplete,
      currentFrame: 0,
    });
    if (!this.running) this.start();
  }

  remove(id: string): void {
    this.animations.delete(id);
    if (this.animations.size === 0) {
      this.stop();
    }
  }

  private tick(): void {
    const completed: string[] = [];

    for (const [id, anim] of this.animations) {
      anim.onFrame(anim.currentFrame, anim.totalFrames, anim.currentFrame / this.fps);
      anim.currentFrame++;

      if (anim.currentFrame >= anim.totalFrames) {
        completed.push(id);
        anim.onComplete?.();
      }
    }

    for (const id of completed) {
      this.animations.delete(id);
    }

    if (this.animations.size === 0) {
      this.stop();
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  get activeCount(): number {
    return this.animations.size;
  }
}

export const animationEngine = new AnimationEngine();
