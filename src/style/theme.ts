export interface Theme {
  accent: string;
  accentDim: string;
  text: string;
  muted: string;
  subtle: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  bg?: string;
}

export type BuiltinThemeName =
  | "cyberpunk"
  | "dracula"
  | "nord"
  | "monokai"
  | "solarized"
  | "gruvbox"
  | "catppuccin"
  | "tokyoNight"
  | "rosePine"
  | "hacker";

export const themes: Record<BuiltinThemeName, Theme> = {
  cyberpunk: {
    accent: "#ff2a6d",
    accentDim: "#b91d4f",
    text: "#05d9e8",
    muted: "#0abdc6",
    subtle: "#01579b",
    success: "#05d9e8",
    warning: "#d1f7ff",
    error: "#ff2a6d",
    border: "#01579b",
    bg: "#01012b",
  },
  dracula: {
    accent: "#ff79c6",
    accentDim: "#bd93f9",
    text: "#f8f8f2",
    muted: "#6272a4",
    subtle: "#44475a",
    success: "#50fa7b",
    warning: "#f1fa8c",
    error: "#ff5555",
    border: "#6272a4",
    bg: "#282a36",
  },
  nord: {
    accent: "#88c0d0",
    accentDim: "#5e81ac",
    text: "#eceff4",
    muted: "#81a1c1",
    subtle: "#4c566a",
    success: "#a3be8c",
    warning: "#ebcb8b",
    error: "#bf616a",
    border: "#4c566a",
    bg: "#2e3440",
  },
  monokai: {
    accent: "#f92672",
    accentDim: "#ae81ff",
    text: "#f8f8f2",
    muted: "#75715e",
    subtle: "#49483e",
    success: "#a6e22e",
    warning: "#e6db74",
    error: "#f92672",
    border: "#75715e",
    bg: "#272822",
  },
  solarized: {
    accent: "#268bd2",
    accentDim: "#2aa198",
    text: "#839496",
    muted: "#657b83",
    subtle: "#586e75",
    success: "#859900",
    warning: "#b58900",
    error: "#dc322f",
    border: "#586e75",
    bg: "#002b36",
  },
  gruvbox: {
    accent: "#fe8019",
    accentDim: "#d65d0e",
    text: "#ebdbb2",
    muted: "#a89984",
    subtle: "#504945",
    success: "#b8bb26",
    warning: "#fabd2f",
    error: "#fb4934",
    border: "#504945",
    bg: "#282828",
  },
  catppuccin: {
    accent: "#f5c2e7",
    accentDim: "#cba6f7",
    text: "#cdd6f4",
    muted: "#a6adc8",
    subtle: "#45475a",
    success: "#a6e3a1",
    warning: "#f9e2af",
    error: "#f38ba8",
    border: "#585b70",
    bg: "#1e1e2e",
  },
  tokyoNight: {
    accent: "#7aa2f7",
    accentDim: "#bb9af7",
    text: "#c0caf5",
    muted: "#565f89",
    subtle: "#3b4261",
    success: "#9ece6a",
    warning: "#e0af68",
    error: "#f7768e",
    border: "#3b4261",
    bg: "#1a1b26",
  },
  rosePine: {
    accent: "#ebbcba",
    accentDim: "#c4a7e7",
    text: "#e0def4",
    muted: "#908caa",
    subtle: "#6e6a86",
    success: "#9ccfd8",
    warning: "#f6c177",
    error: "#eb6f92",
    border: "#6e6a86",
    bg: "#191724",
  },
  hacker: {
    accent: "#00ff41",
    accentDim: "#008f11",
    text: "#00ff41",
    muted: "#008f11",
    subtle: "#003b00",
    success: "#00ff41",
    warning: "#ccff00",
    error: "#ff0000",
    border: "#008f11",
    bg: "#0d0208",
  },
};

export const defaultTheme = themes.dracula;
