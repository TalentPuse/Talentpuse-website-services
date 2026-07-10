describe("AI_HOME flag", () => {
  const OLD = process.env.NEXT_PUBLIC_AI_HOME;
  afterEach(() => {
    process.env.NEXT_PUBLIC_AI_HOME = OLD;
    jest.resetModules();
  });

  it("off khi env unset", () => {
    delete process.env.NEXT_PUBLIC_AI_HOME;
    jest.resetModules();
    const { AI_HOME } = require("@/lib/flags");
    expect(AI_HOME).toBe(false);
  });

  it("on khi env = 1", () => {
    process.env.NEXT_PUBLIC_AI_HOME = "1";
    jest.resetModules();
    const { AI_HOME } = require("@/lib/flags");
    expect(AI_HOME).toBe(true);
  });
});
