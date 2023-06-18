import { EmptyFluent } from "../core";
import { shortCircuit } from "../errors";

export function optional<This extends EmptyFluent>(this: This) {
  return this.shortCircuit((input) => {
    if (input === undefined) return shortCircuit(undefined);
    return input;
  });
}
