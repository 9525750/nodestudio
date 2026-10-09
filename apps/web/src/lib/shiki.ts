// ACT: Markdown currently uses plain text highlighting; keep the library's Web entry to avoid bundling all languages.
export * from "shiki/bundle/web";
export { createJavaScriptRegexEngine } from "shiki/engine/javascript";
