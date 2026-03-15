import {
  extractOperations,
  toPythonType,
  toPascalCase,
  toSnakeCase,
  type OperationInfo,
} from './shared'

function generateDataclasses(spec: Record<string, unknown>): string {
  const components = spec.components as Record<string, unknown> | undefined
  const schemas = (components?.schemas || {}) as Record<string, Record<string, unknown>>
  const lines: string[] = [
    'from __future__ import annotations',
    'from dataclasses import dataclass, field',
    'from typing import Any, Dict, List, Optional, Union',
    '',
  ]

  for (const [name, schema] of Object.entries(schemas)) {
    const className = toPascalCase(name)

    if (schema.enum) {
      lines.push(`# ${className} enum values: ${(schema.enum as unknown[]).join(', ')}`)
      lines.push(`${className} = str`)
      lines.push('')
      continue
    }

    if (schema.type === 'object' || schema.properties) {
      const props = (schema.properties || {}) as Record<string, Record<string, unknown>>
      const required = new Set((schema.required || []) as string[])
      lines.push('@dataclass')
      lines.push(`class ${className}:`)
      if (schema.description) lines.push(`    """${schema.description}"""`)

      const entries = Object.entries(props)
      if (entries.length === 0) {
        lines.push('    pass')
      } else {
        const requiredFields: string[] = []
        const optionalFields: string[] = []
        for (const [propName, propSchema] of entries) {
          const pyName = toSnakeCase(propName)
          const pyType = toPythonType(propSchema)
          if (required.has(propName)) {
            requiredFields.push(`    ${pyName}: ${pyType}`)
          } else {
            optionalFields.push(`    ${pyName}: Optional[${pyType}] = None`)
          }
        }
        lines.push(...requiredFields, ...optionalFields)
      }
      lines.push('')
    } else {
      lines.push(`${className} = ${toPythonType(schema)}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function buildPathTemplate(path: string): string {
  return path.replace(/\{([^}]+)\}/g, (_, name) => `{${toSnakeCase(name)}}`)
}

function generateEndpointClass(tag: string, ops: OperationInfo[], pkgName: string): string {
  const className = `${toPascalCase(tag)}Api`
  const lines: string[] = [
    'from __future__ import annotations',
    'from typing import Any, Dict, List, Optional',
    `from ${pkgName}.client import Client`,
    `from ${pkgName}.types import *`,
    '',
    '',
    `class ${className}:`,
    '    def __init__(self, client: Client) -> None:',
    '        self._client = client',
    '',
  ]

  for (const op of ops) {
    const methodName = toSnakeCase(op.operationId)
    const pathParams = op.parameters.filter((p) => p.in === 'path')
    const queryParams = op.parameters.filter((p) => p.in === 'query')
    const returnType = op.responseSchema ? toPythonType(op.responseSchema) : 'None'

    const args: string[] = ['self']
    for (const p of pathParams) {
      args.push(`${toSnakeCase(p.name)}: ${toPythonType(p.schema)}`)
    }
    if (op.requestBody) {
      args.push(`body: ${toPythonType(op.requestBody.schema)}`)
    }
    for (const q of queryParams) {
      const pyType = toPythonType(q.schema)
      if (q.required) {
        args.push(`${toSnakeCase(q.name)}: ${pyType}`)
      } else {
        args.push(`${toSnakeCase(q.name)}: Optional[${pyType}] = None`)
      }
    }

    lines.push(`    def ${methodName}(${args.join(', ')}) -> ${returnType}:`)
    if (op.summary) lines.push(`        """${op.summary}"""`)

    const pathTemplate = buildPathTemplate(op.path)
    if (pathParams.length > 0) {
      lines.push(`        path = f"${pathTemplate}"`)
    } else {
      lines.push(`        path = "${op.path}"`)
    }

    if (queryParams.length > 0) {
      lines.push('        params: Dict[str, Any] = {}')
      for (const q of queryParams) {
        const pyName = toSnakeCase(q.name)
        if (q.required) {
          lines.push(`        params["${q.name}"] = ${pyName}`)
        } else {
          lines.push(`        if ${pyName} is not None:`)
          lines.push(`            params["${q.name}"] = ${pyName}`)
        }
      }
    }

    const httpMethod = op.method.toLowerCase()
    const reqArgs: string[] = [`"${httpMethod}"`, 'path']
    if (queryParams.length > 0) reqArgs.push('params=params')
    if (op.requestBody) reqArgs.push('json=body')

    lines.push(`        return self._client.request(${reqArgs.join(', ')})`)
    lines.push('')
  }

  return lines.join('\n')
}

export function generatePythonSdk(spec: Record<string, unknown>, packageName: string, version: string): Map<string, string> {
  const files = new Map<string, string>()
  const operations = extractOperations(spec)
  const pkgDir = toSnakeCase(packageName.replace(/-/g, '_'))

  // types.py
  files.set(`${pkgDir}/types.py`, generateDataclasses(spec))

  // client.py
  files.set(`${pkgDir}/client.py`, `from __future__ import annotations
from typing import Any, Dict, Optional
import httpx


class ApiError(Exception):
    def __init__(self, status_code: int, message: str, body: str) -> None:
        self.status_code = status_code
        self.message = message
        self.body = body
        super().__init__(f"API Error {status_code}: {message}")


class Client:
    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: float = 30.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._headers: Dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            self._headers["Authorization"] = f"Bearer {api_key}"
        if headers:
            self._headers.update(headers)
        self._http = httpx.Client(
            base_url=self.base_url,
            headers=self._headers,
            timeout=timeout,
        )

    def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json: Any = None,
    ) -> Any:
        response = self._http.request(method, path, params=params, json=json)
        if not response.is_success:
            raise ApiError(response.status_code, response.reason_phrase, response.text)
        if response.status_code == 204:
            return None
        return response.json()

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "Client":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
`)

  // Group by tag
  const byTag = new Map<string, OperationInfo[]>()
  for (const op of operations) {
    const tag = op.tags[0] || 'default'
    if (!byTag.has(tag)) byTag.set(tag, [])
    byTag.get(tag)!.push(op)
  }

  const endpointImports: string[] = []
  const endpointAttrs: string[] = []
  const endpointInits: string[] = []

  for (const [tag, ops] of byTag) {
    const fileName = toSnakeCase(tag)
    const className = `${toPascalCase(tag)}Api`
    files.set(`${pkgDir}/endpoints/${fileName}.py`, generateEndpointClass(tag, ops, pkgDir))
    endpointImports.push(`from ${pkgDir}.endpoints.${fileName} import ${className}`)
    endpointAttrs.push(`        self.${toSnakeCase(tag)}: ${className} = ${className}(self._client)`)
    endpointInits.push(`        self.${toSnakeCase(tag)} = ${className}(self._client)`)
  }

  // endpoints/__init__.py
  files.set(`${pkgDir}/endpoints/__init__.py`, '')

  // __init__.py
  files.set(`${pkgDir}/__init__.py`, `from ${pkgDir}.client import Client, ApiError
${endpointImports.join('\n')}


class ${toPascalCase(packageName)}:
    def __init__(self, base_url: str, api_key: str | None = None, **kwargs) -> None:
        self._client = Client(base_url=base_url, api_key=api_key, **kwargs)
${endpointAttrs.join('\n')}

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


__all__ = ["${toPascalCase(packageName)}", "Client", "ApiError"]
`)

  // setup.py
  files.set('setup.py', `from setuptools import setup, find_packages

setup(
    name="${packageName}",
    version="${version}",
    packages=find_packages(),
    install_requires=["httpx>=0.24"],
    python_requires=">=3.8",
    description="Python SDK for ${(spec.info as Record<string, unknown>)?.title || 'the API'}",
)
`)

  // requirements.txt
  files.set('requirements.txt', 'httpx>=0.24\n')

  // README.md
  const firstTag = Array.from(byTag.keys())[0] || 'default'
  const firstOp = operations[0]
  const exampleMethod = firstOp ? toSnakeCase(firstOp.operationId) : 'list_items'

  files.set('README.md', `# ${packageName}

Python SDK for ${(spec.info as Record<string, unknown>)?.title || 'the API'} (v${version}).

## Installation

\`\`\`bash
pip install ${packageName}
\`\`\`

## Usage

\`\`\`python
from ${pkgDir} import ${toPascalCase(packageName)}

client = ${toPascalCase(packageName)}(
    base_url="${((spec.servers as Record<string, unknown>[] | undefined)?.[0] as Record<string, unknown> | undefined)?.url || 'https://api.example.com'}",
    api_key="your-api-key",
)

# Example
result = client.${toSnakeCase(firstTag)}.${exampleMethod}()
print(result)
\`\`\`

## Context Manager

\`\`\`python
with ${toPascalCase(packageName)}(base_url="...", api_key="...") as client:
    result = client.${toSnakeCase(firstTag)}.${exampleMethod}()
\`\`\`
`)

  return files
}
