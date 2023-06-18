import { EmptyFluent, Fluent } from "../core";

/**
 * Validates that the input is a string.
 */
function string<This extends EmptyFluent>(this: This, message?: string) {
  return this.checkType(
    (input): input is string => typeof input === "string",
    (meta: any) => message ?? meta.errorMessages.string_type(meta),
    "string_type"
  );
}
string.errors = {
  string_type: (meta: any) =>
    "label" in meta ? `${meta.label} must be a string` : "Must be a string",
};

function minChars<This extends Fluent<string | any[]>>(
  this: This,
  min: number,
  message?: string
) {
  return this.check(
    (data) => data.length >= min,
    (meta: any) => message ?? meta.errorMessages.min_chars(meta, min),
    "min_chars"
  );
}
minChars.errors = {
  min_chars: (meta: any, min: number) =>
    "label" in meta
      ? `${meta.label} must be at least ${meta.min} characters`
      : `Must be at least ${min} characters`,
};

export { string, minChars as minChars };
