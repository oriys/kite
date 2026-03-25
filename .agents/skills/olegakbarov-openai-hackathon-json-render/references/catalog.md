# Catalogs

Catalogs define the contract between the model and your UI. They are created with createCatalog and include components, actions, and validation functions.

createCatalog inputs
- components: map of component definitions
- actions: map of action definitions
- validationFunctions: map of named validation functions

Component definition fields
- type: unique string name
- description: explain intent and usage
- propsSchema: Zod schema for props
- hasChildren: allow nested children

Actions
- Define each action name with a Zod params schema.
- Use named actions for side effects and navigation.

Validation functions
- Define validators by name so checks can reference them in the UI tree.

Prompt generation
- Use generateCatalogPrompt to build the system prompt for the model.

Design tips
- Keep component props small and explicit.
- Prefer enums or literals for controlled values.
- Use description text to express visual intent and guardrails.
- Use hasChildren to control layout containment.
