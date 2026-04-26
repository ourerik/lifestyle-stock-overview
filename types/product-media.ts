export type ImageQuality = 'low' | 'medium' | 'high'
export type ImageSize =
  | '1024x1024'
  | '1024x1536'
  | '1536x1024'
  | '2000x1000'
  | '1000x2000'
  | '2000x667'
  | '667x2000'
export type ThinkingLevel = 'low' | 'medium' | 'high'

export interface ProductMediaItem {
  displayItemId: string
  articleNo: string         // display.id – unique per color variant
  productNumber: string     // product.productNumber – shared across variants
  displayName: string
  productName: string
  status: string
  categories: string[]
  images: string[]
  generatedCount: number
}

export interface GeneratedImage {
  id: string
  createdAt: string
  prompt: string
  referenceImageUrls: string[]
  size: ImageSize
  quality: ImageQuality
  thinking?: ThinkingLevel
  url: string
}

export interface ArticleMediaMetadata {
  articleNo: string
  updatedAt: string
  generated: GeneratedImage[]
}

export interface ProductMediaDetail {
  displayItemId: string
  articleNo: string
  productNumber: string
  displayName: string
  productName: string
  status: string
  categories: string[]
  images: string[]
  generated: GeneratedImage[]
}

export interface ProductMediaListResponse {
  products: ProductMediaItem[]
  categories: string[]
  cachedAt: string
  fromCache: boolean
}

export interface GenerateImageRequest {
  prompt: string
  referenceImageUrls: string[]
  size: ImageSize
  quality: ImageQuality
  thinking?: ThinkingLevel
}

export interface GenerateImageResponse {
  image: GeneratedImage
}

export interface GlobalReference {
  id: string
  createdAt: string
  label: string
  contentType: string  // e.g. 'image/png' | 'image/jpeg'
  url: string          // pointer to our /api/product-media/global-references/[id]
}

export interface GlobalReferencesMetadata {
  company: string
  updatedAt: string
  references: GlobalReference[]
}

export interface GlobalReferencesListResponse {
  references: GlobalReference[]
}

