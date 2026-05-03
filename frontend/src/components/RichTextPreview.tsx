import { memo, useMemo } from 'react';
import DOMPurify from 'dompurify';
import 'katex/dist/katex.min.css';
import { renderMarkdown } from '../utils/richText';

interface Props {
  text: string;
  className?: string;
  align?: 'left' | 'center';
}

const RichTextPreview = memo(function RichTextPreview({ text, className, align = 'left' }: Props) {
  const html = useMemo(() => DOMPurify.sanitize(renderMarkdown(text || '')), [text]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        color: 'var(--text)',
        lineHeight: 1.7,
        textAlign: align,
      }}
    />
  );
});

export default RichTextPreview;
