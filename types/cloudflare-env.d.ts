/// <reference types="@cloudflare/workers-types" />

// CloudflareEnv types are only used by the entrypoint Worker (worker/index.ts).
// The Next.js app itself runs inside a Cloudflare Container as a normal Node
// process and reads everything via `process.env`.
declare global {
  interface CloudflareEnv {
    // Container Durable Object binding (target for proxied requests)
    APP_CONTAINER: DurableObjectNamespace
  }
}

export {}
