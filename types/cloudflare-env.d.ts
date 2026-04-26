/// <reference types="@cloudflare/workers-types" />

// Extends the CloudflareEnv global declared by @opennextjs/cloudflare with
// this app's own bindings. Accessed via `getCloudflareContext().env.*`.
declare global {
  interface CloudflareEnv {
    // Project-wide R2 bucket. Keys are namespaced by company + feature, e.g.
    //   {company}/product-media/metadata/{articleNo}.json
    //   {company}/product-media/images/{articleNo}/{imageId}.png
    STORAGE: R2Bucket;

    // OpenAI API key for gpt-image-2 generation
    OPEN_API_KEY: string;
  }
}

export {};
