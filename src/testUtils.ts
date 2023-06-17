import { expect } from "bun:test";

export const expectType = <T>(arg: T): ReturnType<typeof expect> => expect(arg);
