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

describe("AI_HOME_ENABLED", () => {
  const OLD = process.env.NEXT_PUBLIC_AI_HOME;

  afterEach(() => {
    process.env.NEXT_PUBLIC_AI_HOME = OLD;
    jest.resetModules();
  });

  it('bật khi NEXT_PUBLIC_AI_HOME = "1"', () => {
    process.env.NEXT_PUBLIC_AI_HOME = "1";
    jest.resetModules();
    expect(require("../flags").AI_HOME_ENABLED).toBe(true);
  });

  it("tắt khi biến không được set", () => {
    delete process.env.NEXT_PUBLIC_AI_HOME;
    jest.resetModules();
    expect(require("../flags").AI_HOME_ENABLED).toBe(false);
  });

  it('tắt với bất kỳ giá trị nào khác "1"', () => {
    process.env.NEXT_PUBLIC_AI_HOME = "true";
    jest.resetModules();
    expect(require("../flags").AI_HOME_ENABLED).toBe(false);
  });
});
