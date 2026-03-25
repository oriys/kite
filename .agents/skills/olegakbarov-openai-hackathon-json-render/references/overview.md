# Overview

json-render is a React-focused library for AI-generated UI with guardrails. You define a catalog of allowed components, actions, and validation functions, then AI outputs JSON constrained to that catalog and your app renders it. Streaming is supported so the UI renders progressively as JSON arrives. Core features include guardrails, streaming, code export, data binding with JSON Pointer paths, named actions, and visibility rules.

Key concepts
- Catalog: Zod-based schema that defines components, actions, and validation functions.
- UI tree: A UITree contains a root element and an elements map. Each UIElement has a key, type, props, optional children, and optional visibility or validation metadata.
- Registry: A mapping from component type names to React components.
- Providers: DataProvider, ActionProvider, VisibilityProvider, ValidationProvider supply runtime behavior.
- Streaming: JSONL patch operations progressively build the UI tree as tokens arrive.

Typical flow
1. Define a catalog (components, actions, validation functions).
2. Generate a system prompt from the catalog for the AI model.
3. Stream JSON from the model and render it with Renderer and your registry.
4. Use providers and hooks to bind data, handle actions, evaluate visibility, and validate inputs.
5. Optionally export static code with @json-render/codegen utilities and a project-specific generator.
