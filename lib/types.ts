export type ModelId = 'gpt4' | 'claude' | 'gemini'

export interface Model {
  id: ModelId
  name: string
  provider: string
  badge: string
  color: string
  bgColor: string
  initial: string
}

export const MODELS: Model[] = [
  {
    id: 'gpt4',
    name: 'GPT-5 mini',
    provider: 'Azure EU',
    badge: 'Azure EU',
    color: 'text-model-gpt',
    bgColor: 'bg-model-gpt',
    initial: 'G',
  },
  {
    id: 'claude',
    name: 'Claude Sonnet 4.6',
    provider: 'Bedrock EU',
    badge: 'Bedrock EU',
    color: 'text-model-claude',
    bgColor: 'bg-model-claude',
    initial: 'C',
  },
  {
    id: 'gemini',
    name: 'Gemini 3.5 Flash',
    provider: 'Vertex EU',
    badge: 'Vertex EU',
    color: 'text-model-gemini',
    bgColor: 'bg-model-gemini',
    initial: 'G',
  },
]

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: ModelId
  timestamp: Date
  pseudonymized?: boolean
  replacementsCount?: number
  replacements?: PseudoReplacement[]
  contentSent?: string
  contentOriginal?: string
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  model: ModelId
  useCase?: string
}

export type UseCaseId = 'allgemein' | 'anwalt' | 'arzt' | 'notar'

export interface PseudoReplacement {
  token: string
  original: string
  type: 'PERSON' | 'DATUM' | 'TELEFON' | 'EMAIL' | 'IBAN' | 'ADRESSE' | 'ORG'
}

export interface PseudonymizationResult {
  original: string
  pseudonymized: string
  replacements: PseudoReplacement[]
}

export interface KnowledgeDocument {
  id: string
  name: string
  content: string
  size: number
  uploadedAt: Date
  chunks: number
}
