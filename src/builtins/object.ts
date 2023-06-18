import { EmptyFluent, FluentError, FluentPipeline, Infer } from "..";

export type FluentObjectShape = Record<
  string | number | symbol,
  FluentPipeline<any, any, any, any, any>
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
    const results: Record<string, any> = {};
    const errors: Record<string, FluentError> = {};

    const handleError = (err: unknown, key: any) => {
      if (err instanceof FluentError) errors[key] = err;
      else throw err;
    };

    for (const [key, value] of Object.entries(shape)) {
      const prop = (input as any)[key];
      let validated;
      try {
        validated = value.runFluentPipeline(prop);
        results[key] = validated;
      } catch (err) {
        handleError(err, key);
      }
    }

    if (Object.values(results).some((prop) => prop instanceof Promise)) {
      const keys = Object.keys(results);
      Promise.allSettled(Object.values(results)).then((promiseResult) => {
        promiseResult.forEach((result, index) => {
          if (result.status === "rejected") {
            const key = keys[index];
            if (result.reason instanceof FluentError)
              errors[key] = result.reason;
            else throw result.reason;
          } else {
            results[keys[index]] = result.value;
          }
        });
      }) as any;
    }

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
