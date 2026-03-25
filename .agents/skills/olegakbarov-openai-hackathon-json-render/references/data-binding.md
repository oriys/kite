# Data Binding

json-render uses JSON Pointer (RFC 6901) paths to reference data inside your state.

DataProvider
- Wrap your app in DataProvider and pass initial data.
- The provider enables hooks to resolve JSON Pointer references in component props.

Hooks
- useData(): access full data and helpers.
- useDataValue(path): get the current value at a JSON Pointer.
- useDataBinding(path): get a binding object for updates and metadata.

Usage tips
- Use JSON Pointer paths for any prop that should be data driven.
- Validate that paths exist before rendering or provide fallbacks.
