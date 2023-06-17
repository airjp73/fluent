import { Fluent } from "../core";

function label<This extends Fluent<unknown>, Label extends string>(
  this: This,
  label: Label
) {
  return this.updateMeta({ label });
}

export { label };
