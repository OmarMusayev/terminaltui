export interface Font {
  name: string;
  height: number;
  chars: Record<string, string[]>;
}
