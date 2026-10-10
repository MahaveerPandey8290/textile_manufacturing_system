/** Label + control + hint/error, consistently spaced. Pass the input as children. */
export function FormField({ label, hint, error, children, className = '' }) {
  return (
    <label className={`form-field ${error ? 'has-error' : ''} ${className}`}>
      <span className="form-field__label">{label}</span>
      {children}
      {error ? <span className="form-field__error">{error}</span> : hint ? <span className="form-field__hint">{hint}</span> : null}
    </label>
  );
}

/** Turns server validation details ([{field, message}]) into { field: message }. */
export function fieldErrorsFrom(error) {
  if (!Array.isArray(error?.details)) return {};
  return Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]));
}
