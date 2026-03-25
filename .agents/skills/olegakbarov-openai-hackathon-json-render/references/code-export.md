# Code Export and Codegen

json-render supports exporting a UITree into standalone code via @json-render/codegen utilities and a project specific generator.

Utilities
- collectUsedComponents: gather component usage.
- collectDataPaths: gather JSON Pointer data paths.
- collectActions: gather action usage.
- serializeProps: turn props into generated code.

Generator workflow
1. Parse the UITree and collect usage data.
2. Map component types to framework specific templates.
3. Emit components, props, and bindings into files.
4. Produce a runnable project or snippet.

Tips
- Keep generator logic in your project, not in the json-render core.
- Only export components that exist in your registry and catalog.
