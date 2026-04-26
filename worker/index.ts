// Tiny entrypoint Worker. All real logic runs inside the Container (Next.js).
// We just route every request to a single named container instance per region.
import type { AppContainer } from './container'

interface Env {
  APP_CONTAINER: DurableObjectNamespace<AppContainer>
}

export { AppContainer } from './container'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Single named instance — Cloudflare auto-spreads instances geographically
    // when traffic justifies it. For our internal-tool profile a single warm
    // container per region is enough.
    const id = env.APP_CONTAINER.idFromName('default')
    const stub = env.APP_CONTAINER.get(id)
    return stub.fetch(request)
  },
}
