import { jsonLd } from "./structured";
import type { Evidence } from "./types";

/**
 * The /paper page: the article itself, its reviewer questions as an FAQ (the same text the page shows) and the
 * application it describes.
 */
export function paperJsonLd(e: Evidence, description: string) {
  const app = jsonLd(e)["@graph"][0];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: `${e.name}: an open front door for purchasing agents at Valio Aimo`,
        description,
        url: `${e.live}/paper`,
        inLanguage: "en",
        license: "https://opensource.org/licenses/MIT",
        about: app,
      },
      {
        "@type": "FAQPage",
        mainEntity: e.questions.map((q) => ({ "@type": "Question", name: q.question, acceptedAnswer: { "@type": "Answer", text: q.answer } })),
      },
    ],
  };
}
