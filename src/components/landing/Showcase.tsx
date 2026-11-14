import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "./Reveal";
import { stagger } from "./stagger";

export type Band = "plain" | "blue" | "lilac" | "petrol";

interface ShowcaseProps {
  id: string;
  title: string;
  line: string;
  link?: { href: string; label: string };
  /** The flat colour band behind the section, as Valio Aimo's own pages alternate them. */
  band: Band;
  /** The picture on the left on wide screens. */
  flip?: boolean;
  children: ReactNode;
}

/** One claim and its proof: a heading, one line, and a real piece of the product beside them. */
export function Showcase({ id, title, line, link, band, flip = false, children }: ShowcaseProps) {
  return (
    <Reveal className="lp-show" data-band={band} aria-labelledby={`${id}-title`}>
      <div className="lp-show-inner" data-flip={flip}>
        <div className="lp-show-text">
          <h2 id={`${id}-title`} className="lp-h2 rv" style={stagger(0)}>
            {title}
          </h2>
          <p className="lp-show-line rv" style={stagger(1)}>
            {line}
          </p>
          {link ? (
            <Link href={link.href} className="lp-text-link rv" style={stagger(2)}>
              {link.label}
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : null}
        </div>
        <div className="lp-show-shot rv" style={stagger(2)}>
          {children}
        </div>
      </div>
    </Reveal>
  );
}
