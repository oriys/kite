# Validation

Validation checks are attached to elements to ensure input correctness.

Catalog validation functions
- Define validation functions by name in the catalog.
- Checks reference these functions in the UI tree.

Validation schema
- A validation schema includes a list of checks.
- Each check can include args, error message, and validateOn timing.

ValidationProvider
- Provide a ValidationProvider to run validation checks.

Hooks
- useFieldValidation(path): check field level validation state.
