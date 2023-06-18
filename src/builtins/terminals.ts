import { Fluent, FluentPipeline, FluentInput } from "../core";

/**
 * Accepts an input and runs it through all the fluent operations, returning the result.
 * @param input - The input to run through the fluent api.
 */
export function apply<
  This extends FluentPipeline<any, any, any, { pipelineType: "data-last" }, any>
>(this: This, input: FluentInput<This>): This["t_current"] {
  return this.runFluentPipeline(input);
}

/**
 * Validates the provided input.
 * @param input - The input to validate.
 * @returns - The validated input afte running any transformations.
 */
export function validate<
  This extends FluentPipeline<any, any, any, { pipelineType: "data-last" }, any>
>(this: This, input: unknown): This["t_current"] {
  return this.runFluentPipeline(input);
}

/**
 * Runs the fluent pipeline and returns the result.
 * Should only be used when the input was provided upfront.
 * @returns - The result of the fluent pipeline.
 */
export function get<
  This extends FluentPipeline<
    any,
    any,
    any,
    { pipelineType: "data-first"; fluentInput: any },
    any
  >
>(this: This): This["t_current"] {
  const val = (this.meta as any).fluentInput;
  return this.runFluentPipeline(val);
}
