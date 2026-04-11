declare module 'katex' {
  interface RenderOptions {
    displayMode?: boolean;
    throwOnError?: boolean;
  }

  interface Katex {
    renderToString(tex: string, options?: RenderOptions): string;
  }

  const katex: Katex;
  export default katex;
}