import { generateTypescriptSdk } from './typescript'
import { generatePythonSdk } from './python'
import { generateGoSdk } from './go'
import type { OpenApiDocument } from './shared'

export type SdkLanguage = 'typescript' | 'python' | 'go'

export function generateSdk(
  spec: OpenApiDocument,
  language: SdkLanguage,
  packageName: string,
  version: string,
): Map<string, string> {
  switch (language) {
    case 'typescript': return generateTypescriptSdk(spec, packageName, version)
    case 'python': return generatePythonSdk(spec, packageName, version)
    case 'go': return generateGoSdk(spec, packageName, version)
  }
}

export { packageSdk } from './packager'
