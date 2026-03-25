---
name: json-render
description: Build and integrate json-render (json-render.dev) for AI generated UIs with guardrails in React. Use when implementing or troubleshooting catalogs, component registries, renderers, data binding, actions, visibility, validation, streaming (JSONL + useUIStream), AI SDK integration, or code export and codegen for json-render.
---

# JSON Render

## Overview
Use this skill to design and implement json-render apps that turn prompts into safe, predictable UI. Focus on catalog design, renderer wiring, providers, and streaming or AI integration. Use the reference files for details and APIs.

## Workflow (end to end)
1. Clarify requirements: framework, design system, data model, actions, auth, streaming needs, and export goals.
2. Build catalog: define components, actions, and validation functions with strict Zod schemas.
3. Create registry: map catalog component types to React components and handle children and onAction.
4. Wire providers: DataProvider, ActionProvider, VisibilityProvider, ValidationProvider as needed.
5. Connect AI: generateCatalogPrompt, implement AI SDK route, and use useUIStream on the client.
6. Render: pass tree and registry to Renderer; handle loading and errors.
7. Optional: generate static code using @json-render/codegen utilities in a project specific generator.
8. Test: validate sample JSON trees, action handling, visibility, validation, and streaming behavior.

## Decision guide
- Need AI generated UI? Use generateCatalogPrompt and the AI SDK integration plus streaming docs.
- Need static output? Use code export and @json-render/codegen utilities.
- Need dynamic data? Use data binding and DataProvider.
- Need safe interactions? Use named actions and ActionProvider; include confirm and callbacks.
- Need conditional UI? Use visibility conditions and VisibilityProvider.

## Implementation notes
- Keep catalogs narrow: fewer components and strict props make AI output predictable.
- Encode UI intent in component descriptions and prop names.
- Use JSON Pointer paths for any data dependent props.
- Treat actions as intent only; implement side effects in ActionProvider handlers.
- Prefer streaming for UX; handle abort and error states.

## References
- Start with `references/overview.md` for core concepts and the json-render workflow.
- Use `references/catalog.md`, `references/components.md`, and `references/core-api.md` for schema and core API details.
- Use `references/react-api.md` for provider and hook signatures.
- Use `references/data-binding.md`, `references/actions.md`, `references/visibility.md`, and `references/validation.md` for runtime behavior.
- Use `references/ai-sdk.md` and `references/streaming.md` for AI integration and JSONL patch operations.
- Use `references/code-export.md` for export and @json-render/codegen utilities.

## Output expectations
- Provide TypeScript examples when possible.
- When building a new integration, show catalog, registry, and provider wiring.
- When adding AI integration, include both server route and client hook wiring.
- When debugging, ask for the catalog, a sample JSON tree, and the component registry.
