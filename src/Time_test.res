open Vitest

describe("Time.format", () => {
  test("zero", t => t->expect(Time.format(0.))->Expect.toBe("0:00.000"))
  test("sub-second, pads to 3 digits", t => t->expect(Time.format(432.))->Expect.toBe("0:00.432"))
  test("seconds pad to 2 digits", t => t->expect(Time.format(5000.))->Expect.toBe("0:05.000"))
  test("minutes, seconds and millis", t => t->expect(Time.format(65432.))->Expect.toBe("1:05.432"))
  test("two-digit minutes are not padded", t => t->expect(Time.format(600000.))->Expect.toBe("10:00.000"))
  test("truncates fractional milliseconds", t => t->expect(Time.format(1999.9))->Expect.toBe("0:01.999"))
})
