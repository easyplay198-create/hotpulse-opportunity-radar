import type { ReactNode } from 'react';
import './VisualPrimitives.css';

type PagePurposeProps = {
  eyebrow?: string;
  title: string;
  description: string;
  meta?: ReactNode;
};

export function PagePurpose({ eyebrow, title, description, meta }: PagePurposeProps) {
  return (
    <section className="pagePurpose" aria-label={title}>
      {eyebrow ? <p className="pagePurpose__eyebrow">{eyebrow}</p> : null}
      <h1 className="pagePurpose__title">{title}</h1>
      <p className="pagePurpose__description">{description}</p>
      {meta ? <div className="pagePurpose__meta">{meta}</div> : null}
    </section>
  );
}
