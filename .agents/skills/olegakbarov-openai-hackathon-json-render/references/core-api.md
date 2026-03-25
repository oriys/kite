# Core API

Types
- UITree: root key plus elements map.
- UIElement: key, type, props, children, and optional visible or validation metadata.
- Action: name, params, optional confirm, and optional onSuccess/onError callbacks.

Functions
- createCatalog: define components, actions, and validation functions.
- generateCatalogPrompt: create a system prompt for the model.
- evaluateVisibility: evaluate visibility conditions.

Validation and visibility
- Validation checks can include validateOn to control timing.
- Visibility conditions can include data path, auth state, and logical operators.
