import { expect, it } from "bun:test";
import { e } from "../preconfigured/everything";
import { expectType } from "../testUtils";
import { FluentError } from "..";

it("should validate object properties", () => {
  const v = e().object({
    name: e().string().minChars(5),
  });

  expectType<{ name: string }>(v.validate({ name: "hello" })).toEqual({
    name: "hello",
  });

  // `toThrow` won't check the `path` property, so we have to do this
  const getError = (func: () => any) => {
    try {
      func();
    } catch (err) {
      return err;
    }
  };
  const err = getError(() => v.validate({ name: 123 }));
  expect(err).toBeInstanceOf(FluentError);
  expect((err as FluentError).toDetails()).toEqual({
    code: "object_shape",
    message: e.__fluentMethods.object.errors.object_shape({}),
    path: [],
    childIssues: [
      {
        code: "string_type",
        message: e.__fluentMethods.string.errors.string_type({}),
        path: ["name"],
        childIssues: [],
      },
    ],
  });
});
