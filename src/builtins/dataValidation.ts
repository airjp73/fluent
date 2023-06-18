import { EmptyFluent } from "../core";
import { shortCircuit } from "../errors";

export function optional<This extends EmptyFluent>(this: This) {
  return this.shortCircuit((input) => {
    if (input === undefined) return shortCircuit(undefined);
    return input;
  }).updateMeta({ optional: true });
}

export function required<This extends EmptyFluent>(
  this: This,
  message?: string
) {
  return this.check(
    (input: any) => input !== undefined,
    (meta: any) => message ?? meta.errorMessages.required(meta),
    "required"
  ).updateMeta({ required: true });
}
required.errors = {
  required: (meta: any) =>
    "label" in meta ? `${meta.label} is required` : "This field is required",
};
