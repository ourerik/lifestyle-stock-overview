import { Container } from '@cloudflare/containers'

// Type of the Cloudflare-side bindings/secrets that need to flow through to
// the Node container as process.env values.
interface ForwardedEnv {
  // Auth0
  AUTH0_SECRET?: string
  AUTH0_BASE_URL?: string
  AUTH0_DOMAIN?: string
  AUTH0_ISSUER_BASE_URL?: string
  AUTH0_CLIENT_ID?: string
  AUTH0_CLIENT_SECRET?: string
  APP_BASE_URL?: string

  // OpenAI
  OPEN_API_KEY?: string

  // R2 via S3 API
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_ENDPOINT?: string
  R2_BUCKET?: string

  // Centra
  SNEAKY_CENTRA_API_KEY?: string
  SNEAKY_CENTRA_BASE_URL?: string
  VARG_CENTRA_API_KEY?: string
  VARG_CENTRA_BASE_URL?: string
  DISENTIS_CENTRA_API_KEY?: string
  DISENTIS_CENTRA_BASE_URL?: string

  // Zettle
  SNEAKY_ZETTLE_CLIENT_ID?: string
  SNEAKY_ZETTLE_API_KEY?: string
  VARG_ZETTLE_CLIENT_ID?: string
  VARG_ZETTLE_API_KEY?: string

  // Elasticsearch
  ELASTICSEARCH_URL?: string
  ELASTICSEARCH_API_KEY?: string

  // CosmosDB
  SNEAKY_NE_PROD_PRIMARY_CONNECTION_STRING?: string

  // Cron
  CRON_SECRET?: string
}

const FORWARDED_KEYS: ReadonlyArray<keyof ForwardedEnv> = [
  'AUTH0_SECRET',
  'AUTH0_BASE_URL',
  'AUTH0_DOMAIN',
  'AUTH0_ISSUER_BASE_URL',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
  'APP_BASE_URL',
  'OPEN_API_KEY',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ENDPOINT',
  'R2_BUCKET',
  'SNEAKY_CENTRA_API_KEY',
  'SNEAKY_CENTRA_BASE_URL',
  'VARG_CENTRA_API_KEY',
  'VARG_CENTRA_BASE_URL',
  'DISENTIS_CENTRA_API_KEY',
  'DISENTIS_CENTRA_BASE_URL',
  'SNEAKY_ZETTLE_CLIENT_ID',
  'SNEAKY_ZETTLE_API_KEY',
  'VARG_ZETTLE_CLIENT_ID',
  'VARG_ZETTLE_API_KEY',
  'ELASTICSEARCH_URL',
  'ELASTICSEARCH_API_KEY',
  'SNEAKY_NE_PROD_PRIMARY_CONNECTION_STRING',
  'CRON_SECRET',
]

// SDK private surface we reach into to mark the container healthy without
// running its built-in port-readiness probe (the probe issues an http://
// fetch that workerd currently rejects as HTTPS — see startAndWaitForPorts
// override below).
interface ContainerInternals {
  state: { setHealthy(): Promise<void> }
}

export class AppContainer extends Container<ForwardedEnv> {
  defaultPort = 3000
  sleepAfter = '30m'

  override envVars: Record<string, string> = {}

  constructor(ctx: DurableObjectState<unknown>, env: ForwardedEnv) {
    super(ctx as ConstructorParameters<typeof Container<ForwardedEnv>>[0], env)
    const forwarded: Record<string, string> = {}
    for (const key of FORWARDED_KEYS) {
      const value = env[key]
      if (typeof value === 'string' && value.length > 0) {
        forwarded[key] = value
      }
    }
    this.envVars = forwarded
  }

  // The SDK's port-readiness probe does `tcpPort.fetch('http://...')`, which
  // workerd rejects as HTTPS in our current runtime. We replace the wait flow
  // with a plain start + brief sleep — the proxied request that follows will
  // surface any real listen failures, and we keep alarms/monitor intact since
  // the parent constructor already wired them up.
  override async startAndWaitForPorts(): Promise<void> {
    const container = this.ctx.container
    if (!container) throw new Error('Container binding missing')
    if (!container.running) {
      container.start({ env: this.envVars, enableInternet: true })
      await new Promise((r) => setTimeout(r, 2000))
    }
    await (this as unknown as ContainerInternals).state.setHealthy()
  }

  override onError(error: unknown) {
    console.error('[AppContainer] error:', error)
  }
}
