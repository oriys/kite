# Actions

Actions are named intents produced by the UI tree and handled by your app.

Catalog actions
- Define each action name and params schema in the catalog.
- Keep params minimal and validated.

ActionProvider
- Provide an ActionProvider with handlers for each action name.
- Handlers implement side effects (navigation, API calls, state updates).

Hooks
- useAction(name): get a function for dispatching an action by name.

Action metadata in UI elements
- Elements can include action details such as confirm, onSuccess, and onError.
- onSuccess or onError can set data paths after an action completes.
