import { Fluent, FluentPipeline, FluentInput } from "../core";

/**
 * Accepts an input and runs it through all the fluent operations, returning the result.
 * @param input - The input to run through the fluent api.
 */
export function apply<This extends Fluent>(
  this: This,
  input: FluentInput<This>
): This["t_output"] {
  return this.runFluentPipeline(input);
}

/**
 * Validates the provided input.
 * @param input - The input to validate.
 * @returns - The validated input afte running any transformations.
 */
export function validate<This extends Fluent>(
  this: This,
  input: unknown
): This["t_output"] {
  return this.runFluentPipeline(input);
}

/**
 * Runs the fluent pipeline and returns the result.
 * Should only be used when the input was provided upfront.
 * @returns - The result of the fluent pipeline.
 */
export function get<
  This extends FluentPipeline<any, any, any, { fluentInput: any }, any>
>(this: This): This["t_output"] {
  const val = (this.meta as any).fluentInput;
  return this.runFluentPipeline(val);
}
