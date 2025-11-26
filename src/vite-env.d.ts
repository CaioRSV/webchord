/// <reference types="vite/client" />

declare module '*.wasm' {
  const content: string;
  export default content;
}

