import { expect, it } from "bun:test";
import { e } from "../preconfigured/everything";
import { expectType } from "../testUtils";
import { FluentError } from "..";

const getErrorDetails = (func: () => any) => {
  try {
    func();
    throw new Error("Function did not throw");
  } catch (err) {
    expect(err).toBeInstanceOf(FluentError);
    return (err as FluentError).toDetails();
  }
};

it("should validate object properties", () => {
  const v = e().object({
    name: e().string().minChars(5),
    pizza: e().string().minChars(3),
    stateAbbrev: e().string().maxChars(2),
    note: e().required().string(),
    nested: e().object({
      foo: e().object({
        bar: e().string(),
      }),
    }),
  });

  expectType<{
    name: string;
    pizza: string;
    stateAbbrev: string;
    note: string;
    nested: { foo: { bar: string } };
  }>(
    v.validate({
      name: "hello",
      pizza: "Pepperoni",
      stateAbbrev: "CA",
      note: "hi",
      nested: { foo: { bar: "hello" } },
    })
  ).toEqual({
    name: "hello",
    pizza: "Pepperoni",
    stateAbbrev: "CA",
    note: "hi",
    nested: { foo: { bar: "hello" } },
  });

  const err = getErrorDetails(() =>
    v.validate({
      name: 123,
      stateAbbrev: "Vermont",
      nested: {
        foo: {
          bar: 123,
        },
      },
    })
  );
  expect(err).toEqual({
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
      {
        code: "string_type",
        message: e.__fluentMethods.string.errors.string_type({}),
        path: ["pizza"],
        childIssues: [],
      },
      {
        code: "max_chars",
        message: e.__fluentMethods.maxChars.errors.max_chars({}, 2),
        path: ["stateAbbrev"],
        childIssues: [],
      },
      {
        code: "required",
        message: e.__fluentMethods.required.errors.required({}),
        path: ["note"],
        childIssues: [],
      },
      {
        code: "object_shape",
        message: e.__fluentMethods.object.errors.object_shape({}),
        path: ["nested"],
        childIssues: [
          {
            code: "object_shape",
            message: e.__fluentMethods.object.errors.object_shape({}),
            path: ["nested", "foo"],
            childIssues: [
              {
                code: "string_type",
                message: e.__fluentMethods.string.errors.string_type({}),
                path: ["nested", "foo", "bar"],
                childIssues: [],
              },
            ],
          },
        ],
      },
    ],
  });
});
