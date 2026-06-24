import fs from 'fs'
import path from 'path'

export type UseCaseId = 'allgemein' | 'anwalt' | 'arzt' | 'notar'

export interface UseCase {
  id: UseCaseId
  label: string
  prompt: string
}

interface PromptsConfig {
  base: string
  useCases: UseCase[]
}

let cached: PromptsConfig | null = null

function loadConfig(): PromptsConfig {
  if (cached) return cached
  const configPath = path.join(process.cwd(), 'config', 'prompts.json')
  const raw = fs.readFileSync(configPath, 'utf-8')
  cached = JSON.parse(raw) as PromptsConfig
  return cached
}

export function getUseCases(): UseCase[] {
  return loadConfig().useCases
}

export function getSystemPrompt(useCase: string, ragContext?: string): string {
  const config = loadConfig()
  const uc = config.useCases.find(c => c.id === useCase) || config.useCases[0]
  let prompt = `${config.base}\n\n${uc.prompt}`

  if (ragContext) {
    prompt += `\n\nRelevante Informationen aus der Wissensdatenbank:\n\n${ragContext}\n\nNutze diese Informationen wenn relevant für deine Antwort.`
  }

  return prompt
}

export function isValidUseCase(id: string): id is UseCaseId {
  return getUseCases().some(u => u.id === id)
}
