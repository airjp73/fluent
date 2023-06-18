import { describe, it, expect } from "bun:test";
import { MaybePromise } from "./maybePromise";
import { expectType } from "../testUtils";

describe("MaybePromise", () => {
  it("should work with promises", async () => {
    const prom = new MaybePromise(() => Promise.resolve("hello"));
    expect(await prom.await()).toEqual("hello");
    expect(() => prom.assertSync()).toThrow();
  });

  it("should work with non promises", async () => {
    const prom = new MaybePromise(() => "hello");
    expect(await prom.await()).toEqual("hello");
    expect(prom.assertSync()).toEqual("hello");
  });

  it("should be thenable", async () => {
    const test = new MaybePromise(() => "hell")
      .then((value) => value + "o")
      .then((value) => value + "!")
      .then((value) => Promise.resolve(value + "!"))
      .then((value) => new MaybePromise(() => value + "!"));
    expect(await test.await()).toEqual("hello!!!");
  });

  it("should be catchable", () => {
    const test = new MaybePromise(() => {
      throw new Error("Hi");
    })
      .catch((err: any) => err.message)
      .then((msg) => msg + "!");
    expect(test.assertSync()).toEqual("Hi!");
  });

  it("should be catchable with promises", async () => {
    const test = new MaybePromise(() => Promise.reject(new Error("Hi")))
      .catch((err: any) => err.message)
      .then((msg) => msg + "!");
    expect(await test.await()).toEqual("Hi!");
  });

  it("should be catchable with maybe promises", async () => {
    const test = new MaybePromise(
      () =>
        new MaybePromise(() => {
          throw new Error("Hi");
        })
    )
      .catch((err: any) => err.message)
      .then((msg) => msg + "!");
    expect(await test.await()).toEqual("Hi!");
  });

  it("should correctly type transformations when then chaining", async () => {
    const test = new MaybePromise(() => 123)
      .then((value) => {
        expectType<number>(value);
        return value + 1;
      })
      .then((value) => {
        expectType<number>(value);
        return String(value);
      })
      .then((value) => {
        expectType<string>(value);
        return Promise.resolve(value.charCodeAt(0));
      })
      .then((value) => {
        expectType<number>(value);
        return new MaybePromise(() => String(value));
      });
    const result: string = await test.await();
    expect(result).toEqual("49");
  });

  describe("MaybePromise.allSettled", () => {
    it("should collect errors", () => {
      const err = (message: string) => {
        return new MaybePromise(() => {
          throw new Error(message);
        });
      };

      const errs = [
        err("Err1"),
        err("Err2"),
        err("Err3"),
        MaybePromise.of(() => "Ok"),
      ];

      expect(MaybePromise.allSettled(errs).assertSync()).toEqual([
        { status: "rejected", reason: new Error("Err1") },
        { status: "rejected", reason: new Error("Err2") },
        { status: "rejected", reason: new Error("Err3") },
        { status: "fulfilled", value: "Ok" },
      ]);
    });
  });
});
