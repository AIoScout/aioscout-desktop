// Vite ?raw imports used by the main process (bundled at build time).
declare module '*.md?raw' {
  const content: string;
  export default content;
}
