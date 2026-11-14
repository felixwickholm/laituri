import type { Evidence } from "./types";

/** schema.org description of the demo and its source code. Only fields that are true of this repo. */
export function jsonLd(e: Evidence) {
  const app = {
    "@type": "SoftwareApplication",
    name: e.name,
    description: e.pitch,
    url: e.live,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
    license: "https://opensource.org/licenses/MIT",
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      app,
      {
        "@type": "SoftwareSourceCode",
        name: e.name,
        description: e.pitch,
        programmingLanguage: "TypeScript",
        runtimePlatform: "Node.js",
        license: "https://opensource.org/licenses/MIT",
        targetProduct: app,
      },
    ],
  };
}
