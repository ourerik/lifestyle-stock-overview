export interface ProductRankItem {
  displayItemId: string
  displayName: string
  productName: string
  imageUrl?: string
  status: string
  defaultRank: number | null
}

export interface ProductRankingData {
  ranked: ProductRankItem[]
  unranked: ProductRankItem[]
}

export interface ProductRankingResponse {
  data: ProductRankingData
  cachedAt: string
  fromCache: boolean
}
