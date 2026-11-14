import { Terminal } from "lucide-react";
import type { ReactElement } from "react";
import type { TileId } from "@/lib/connect/apps";

/*
 * Simple monochrome marks drawn for this page. They identify compatibility only; the product name is
 * always shown next to them. Each mark uses currentColor so it follows the theme.
 */

type Mark = () => ReactElement;

const box = { width: 20, height: 20, viewBox: "0 0 24 24", "aria-hidden": true } as const;

const ClaudeMark: Mark = () => {
  const rays = [9.5, 8, 9, 7.5, 9.5, 8.5, 8, 9.5, 7.5, 9, 8.5, 8];
  return (
    <svg {...box} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
      {rays.map((length, index) => {
        const angle = (index * 30 * Math.PI) / 180;
        const x = (r: number) => (12 + Math.cos(angle) * r).toFixed(2);
        const y = (r: number) => (12 + Math.sin(angle) * r).toFixed(2);
        return <line key={index} x1={x(2.2)} y1={y(2.2)} x2={x(length)} y2={y(length)} />;
      })}
    </svg>
  );
};

const ChatGptMark: Mark = () => (
  <svg {...box} fill="none" stroke="currentColor" strokeWidth="1.7">
    {[0, 60, 120].map((angle) => (
      <rect key={angle} x="3.2" y="8.6" width="17.6" height="6.8" rx="3.4" transform={`rotate(${angle} 12 12)`} />
    ))}
  </svg>
);

const CursorMark: Mark = () => (
  <svg {...box} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
    <path d="M12 2.5 20.5 7.25v9.5L12 21.5l-8.5-4.75v-9.5Z" />
    <path d="M12 12 20.5 7.25M12 12v9.5M12 12 3.5 7.25" />
    <path d="M12 12 20.5 7.25 12 2.5Z" fill="currentColor" />
  </svg>
);

const GrokMark: Mark = () => (
  <svg {...box} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17.6 6.9A7.5 7.5 0 1 0 19.4 13" />
    <path d="M4.5 20.5 20.5 3.5" />
  </svg>
);

const GeminiMark: Mark = () => (
  <svg {...box} fill="currentColor">
    <path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10Z" />
  </svg>
);

const VsCodeMark: Mark = () => (
  <svg {...box} fill="currentColor" fillRule="evenodd">
    <path d="m17.4 2.1 4 1.9c.4.2.6.6.6 1v14c0 .4-.2.8-.6 1l-4 1.9-9.7-8.7-4.1 3.1L2 15.6V8.4l1.6-.7 4.1 3.1Zm.1 5.2L11.6 12l5.9 4.7Z" />
  </svg>
);

const HttpMark: Mark = () => <Terminal width={20} height={20} strokeWidth={1.8} aria-hidden="true" />;

export const APP_LOGOS: Record<TileId, Mark> = {
  claude: ClaudeMark,
  chatgpt: ChatGptMark,
  cursor: CursorMark,
  grok: GrokMark,
  gemini: GeminiMark,
  vscode: VsCodeMark,
  http: HttpMark,
};
