import { MongoClient } from 'mongodb'
import type { Env } from '@/types'

export interface ProductRank {
  id: string
  defaultRank: number
}

interface ProductRankDocument {
  _id?: unknown
  id: string
  defaultRank: number
}

const DATABASE = 'commerceToolService'
const COLLECTION = 'productRank'

// Reuse client across requests in the same process
let cachedClient: MongoClient | null = null

function getClient(connectionString: string): MongoClient {
  if (!cachedClient) {
    cachedClient = new MongoClient(connectionString, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 15000,
    })
  }
  return cachedClient
}

export class CosmosDBConnector {
  private client: MongoClient

  constructor(env: Env) {
    const connectionString = env.SNEAKY_NE_PROD_PRIMARY_CONNECTION_STRING
    if (!connectionString) {
      throw new Error('Missing SNEAKY_NE_PROD_PRIMARY_CONNECTION_STRING environment variable')
    }
    this.client = getClient(connectionString)
  }

  private get collection() {
    return this.client.db(DATABASE).collection<ProductRankDocument>(COLLECTION)
  }

  async fetchProductRanks(): Promise<ProductRank[]> {
    const docs = await this.collection.find({}).toArray()
    return docs.map((doc) => ({
      id: doc.id,
      defaultRank: doc.defaultRank,
    }))
  }

  async upsertProductRank(rank: ProductRank): Promise<void> {
    await this.collection.updateOne(
      { id: rank.id },
      { $set: { id: rank.id, defaultRank: rank.defaultRank } },
      { upsert: true }
    )
  }

  async upsertProductRanks(ranks: ProductRank[]): Promise<void> {
    if (ranks.length === 0) return

    const operations = ranks.map((rank) => ({
      updateOne: {
        filter: { id: rank.id },
        update: { $set: { id: rank.id, defaultRank: rank.defaultRank } },
        upsert: true,
      },
    }))

    await this.collection.bulkWrite(operations)
  }
}
