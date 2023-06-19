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

it("should not allow properties to already have an input", () => {
  // @ts-expect-error
  const v = e().object({
    name: e("bob").minChars(1),
  });

  expect(v.validate({ name: "jim" })).toEqual({ name: "jim" });
});

it("should transform keys", () => {
  const v = e().object({
    name: e()
      .string()
      .transform((input) => input.toUpperCase()),
  });
  expect(v.validate({ name: "bob" })).toEqual({ name: "BOB" });
});

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

it("should support a catchall type", () => {
  const v = e().object().withCatchall({ name: e().string() }, e().number());

  const res = v.validate({ name: "bob", age: 123 });
  expectType<{ name: string } & Record<string | number, number>>(res).toEqual({
    name: "bob",
    age: 123,
  });
});

it("should combine errors from catchall type and shape", () => {
  const v = e()
    .object()
    .withCatchall({ name: e().string(), notes: e().string() }, e().number());
  const err = getErrorDetails(() => v.validate({ jim: "hi", bob: "lo" }));
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
        path: ["notes"],
        childIssues: [],
      },
      {
        code: "number_type",
        message: e.__fluentMethods.number.errors.number_type({}),
        path: ["jim"],
        childIssues: [],
      },
      {
        code: "number_type",
        message: e.__fluentMethods.number.errors.number_type({}),
        path: ["bob"],
        childIssues: [],
      },
    ],
  });
});
