import { Fluent, FluentPipeline, FluentInput } from "../core";

/**
 * Runs all the fluent operations in the fluent api, returning the result.
 */
export function apply<This extends Fluent<any, void>>(
  this: This
): This["__outputType"];
/**
 * Accepts an input and runs it through all the fluent operations, returning the result.
 * @param input - The input to run through the fluent api.
 */
export function apply<This extends Fluent>(
  this: This,
  input: FluentInput<This>
): This["__outputType"];
export function apply<This extends Fluent>(
  this: This,
  input?: FluentInput<This>
): This["__outputType"] {
  if (this.pipelineSteps.length === 0)
    throw new Error("Cannot apply empty fluent api");
  const result = this.pipelineSteps.reduce((acc, fn) => {
    if (acc instanceof Promise) return acc.then(fn as any);
    return fn(acc);
  }, input as unknown);
  return result;
}

/**
 * Validates the provided input.
 * @param input - The input to validate.
 * @returns - The validated input afte running any transformations.
 */
export function validate<This extends Fluent>(
  this: This,
  input: unknown
): This["__outputType"] {
  return apply.call(this, input as any);
}

/**
 * Runs the fluent pipeline and returns the result.
 * Should only be used when the input was provided upfront.
 * @returns - The result of the fluent pipeline.
 */
export function get<
  This extends FluentPipeline<any, any, any, { fluentInput: any }, any>
>(this: This): This["__outputType"] {
  if (this.pipelineSteps.length === 0)
    throw new Error("Cannot get value from empty fluent api");
  const val = (this.meta as any).fluentInput;
  const result = this.pipelineSteps.reduce((acc, fn) => {
    if (acc instanceof Promise) return acc.then(fn as any);
    return fn(acc);
  }, val);
  return result;
}
