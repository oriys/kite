# Components, Registry, and Renderer

Component registry
- Create a ComponentRegistry that maps component type names to React components.
- Each component receives ComponentProps with props, optional children, and an onAction callback.

Renderer
- Use the Renderer component from @json-render/react.
- Pass the UITree and the registry.
- The renderer walks the tree, instantiates components by type, and passes children.

Implementation notes
- Match registry keys to the component type names in the catalog.
- Ensure components handle children if hasChildren is true in the catalog.
- Use onAction to emit actions from UI elements to the ActionProvider.
