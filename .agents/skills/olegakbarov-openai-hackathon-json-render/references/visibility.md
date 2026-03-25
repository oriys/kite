# Visibility

Visibility rules control whether a UI element is shown.

VisibilityProvider
- Provide a VisibilityProvider to evaluate visibility conditions.
- Conditions can use data paths, auth state, and logical operators.

Hooks
- useIsVisible(condition): compute visibility for a condition.

Tips
- Keep visibility logic simple and declarative.
- Centralize complex checks in provider helpers.
