import { Terminal } from "lucide-react";
import type { ReactElement } from "react";
import type { TileId } from "@/lib/connect/apps";
import { ClaudeLogo } from "./ClaudeLogo";
import { CursorLogo } from "./CursorLogo";
import { GeminiLogo } from "./GeminiLogo";
import { GrokLogo } from "./GrokLogo";
import { OpenAiLogo } from "./OpenAiLogo";
import { VsCodeLogo } from "./VsCodeLogo";

/* Marks identify compatibility only; the product name always stands next to them. Each file names its source. */

const HttpLogo = () => <Terminal width={20} height={20} strokeWidth={1.8} aria-hidden="true" />;

export const APP_LOGOS: Record<TileId, () => ReactElement> = {
  claude: ClaudeLogo,
  chatgpt: OpenAiLogo,
  cursor: CursorLogo,
  grok: GrokLogo,
  gemini: GeminiLogo,
  vscode: VsCodeLogo,
  http: HttpLogo,
};
