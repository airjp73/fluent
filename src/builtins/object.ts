import { EmptyFluent, FluentError, FluentPipeline, Infer } from "..";
import { MaybePromise } from "../util/maybePromise";

export type FluentObjectShape = Record<
  string | number | symbol,
  FluentPipeline<any, any, any, { pipelineType: "data-last" }, any>
>;

type InferShape<Shape extends FluentObjectShape> =
  Promise<any> extends Shape[keyof Shape]
    ? Promise<{
        [K in keyof Shape]: Awaited<Infer<Shape[K]>>;
      }>
    : {
        [K in keyof Shape]: Infer<Shape[K]>;
      };

/**
 * Validates that the input is an object matching the provided shape..
 */
function object<This extends EmptyFluent, Shape extends FluentObjectShape>(
  this: This,
  shape: Shape,
  message?: string
) {
  return this.checkType(
    (input): input is NonNullable<object> =>
      typeof input === "object" || input === null,
    (meta: any) => message ?? meta.errorMessages.object_type(meta),
    "object_type"
  ).transform((input): InferShape<Shape> => {
    const keys = Object.keys(shape);
    const maybePromises = Object.values(shape).map((value, index) => {
      const key = keys[index];
      const propInput = (input as any)[key];
      return MaybePromise.of(() => value.runFluentPipeline(propInput));
    });

    return MaybePromise.allSettled(maybePromises)
      .then((promiseResult) => {
        const results: Record<string, any> = {};
        const errors: Record<string, FluentError> = {};

        promiseResult.map((result, index) => {
          if (result.status === "rejected") {
            const key = keys[index];
            if (result.reason instanceof FluentError)
              errors[key] = result.reason;
            else throw result.reason;
          } else {
            results[keys[index]] = result.value;
          }
        });

        const errorKeys = Object.keys(errors);
        if (errorKeys.length > 0) {
          throw new FluentError(
            "object_shape",
            object.errors.object_shape({}),
            [],
            Object.values(errors).map((error, index) => {
              error.prependPath(errorKeys[index]);
              return error;
            })
          );
        }

        return results as any;
      })
      .flatten();
  });
}
object.errors = {
  object_type: (meta: any) =>
    "label" in meta ? `${meta.label} must be an object` : "Must be an object",
  object_shape: (meta: any) =>
    "label" in meta
      ? `${meta.label} has invalid properties`
      : "Has invalid properties",
};

export { object };
