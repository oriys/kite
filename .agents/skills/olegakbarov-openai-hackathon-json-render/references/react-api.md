# React API

Core components and providers
- Renderer: render a UITree with a ComponentRegistry.
- DataProvider: supply data for JSON Pointer bindings.
- ActionProvider: supply action handlers.
- VisibilityProvider: supply visibility evaluation.
- ValidationProvider: supply validation checks.

Hooks
- useUIStream: build a UITree from a streaming endpoint.
- useData, useDataValue, useDataBinding: resolve JSON Pointer data.
- useAction: dispatch actions by name.
- useIsVisible: compute visibility for a condition.
- useFieldValidation: read validation state for a data path.
