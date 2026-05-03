import katex from 'katex';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(text: string): string {
  let result = escapeHtml(text);

  result = result.replace(/\$\$([^$]+)\$\$/g, (_match, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `$$${tex}$$`;
    }
  });

  result = result.replace(/\$([^$]+)\$/g, (_match, tex) => {
    try {
      return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `$${tex}$`;
    }
  });

  result = result.replace(/`([^`]+)`/g, '<code style="background:rgba(196,149,106,0.15);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>');
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return result;
}

export function renderMarkdown(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith('### ')) {
        return `<h3>${renderInlineMarkdown(block.slice(4))}</h3>`;
      }
      if (block.startsWith('## ')) {
        return `<h2>${renderInlineMarkdown(block.slice(3))}</h2>`;
      }
      if (block.startsWith('# ')) {
        return `<h1>${renderInlineMarkdown(block.slice(2))}</h1>`;
      }
      if (block.split('\n').every((line) => line.trim().startsWith('- '))) {
        const items = block
          .split('\n')
          .map((line) => `<li>${renderInlineMarkdown(line.trim().slice(2))}</li>`)
          .join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${block.split('\n').map((line) => renderInlineMarkdown(line)).join('<br/>')}</p>`;
    })
    .join('');
}
