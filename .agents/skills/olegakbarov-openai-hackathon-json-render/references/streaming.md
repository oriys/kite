# Streaming

json-render supports JSONL streaming where each line is a JSON patch operation.

Patch operations
- op: "set", "add", "replace", or "remove"
- path: JSON Pointer path in the UI tree
- value: element data to apply (for set, add, replace)

Hook
- useUIStream is a client hook that consumes a streaming endpoint and applies patches to build the UITree.
- It exposes the current tree plus loading, error, generate, and abort controls.

Tips
- Use streaming to render the UI progressively.
- Handle abort and error states from the stream.
