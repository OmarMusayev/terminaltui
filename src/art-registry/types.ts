import type { Font } from "../ascii/fonts.js";

export interface SceneData {
  art: string[];
  width?: number;
  scalable?: boolean;
  animated?: boolean;
  author?: string;
  description?: string;
  tags?: string[];
  source?: string;          // "custom" | "pack:name" | "folder"
}

export interface IconData {
  small?: string[];
  medium?: string[];
  large?: string[];
  art?: string[];           // default/auto-sized
  author?: string;
  source?: string;
}

export interface PatternData {
  tile: string[];
  tileWidth: number;
  tileHeight: number;
  author?: string;
  source?: string;
}

export interface ArtPack {
  name: string;
  version?: string;
  author?: string;
  description?: string;
  fonts?: Record<string, string | Font>;    // name -> FLF string or parsed Font
  scenes?: Record<string, string[] | SceneData>;
  icons?: Record<string, string[] | IconData>;
  patterns?: Record<string, PatternData>;
}

export interface AssetInfo {
  name: string;
  type: "font" | "scene" | "icon" | "pattern";
  source: string;
  author?: string;
  description?: string;
}

export type AssetType = "font" | "scene" | "icon" | "pattern";
