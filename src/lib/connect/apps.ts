import type { AppId } from "./guides";

export type TileId = "claude" | "chatgpt" | "cursor" | "grok" | "gemini" | "vscode" | "http";

export interface Tile {
  id: TileId;
  name: string;
  /** The guides behind this tile. Claude has two: the terminal and the chat apps. */
  guides: { id: AppId; label: string }[];
}

export const TILES: Tile[] = [
  { id: "claude", name: "Claude", guides: [{ id: "claude-code", label: "Claude Code" }, { id: "claude", label: "Claude apps" }] },
  { id: "chatgpt", name: "ChatGPT", guides: [{ id: "chatgpt", label: "ChatGPT" }] },
  { id: "cursor", name: "Cursor", guides: [{ id: "cursor", label: "Cursor" }] },
  { id: "grok", name: "Grok", guides: [{ id: "grok", label: "Grok" }] },
  { id: "gemini", name: "Gemini CLI", guides: [{ id: "gemini", label: "Gemini CLI" }] },
  { id: "vscode", name: "VS Code", guides: [{ id: "vscode", label: "VS Code with Copilot" }] },
  { id: "http", name: "Any HTTP client", guides: [{ id: "http", label: "curl" }] },
];
