/** @type {import('ts-jest').JestConfigWithTsJest} */
/** Minimal jest config — unit test cho lib/ + component (jsdom). */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    // CSS phai dung TRUOC alias "@/". moduleNameMapper xet theo THU TU va dung
    // o luat khop dau tien: de sau thi `import("@/app/copilotkit-theme.css")`
    // khop `^@/(.*)$` truoc, tra ve file CSS that, va Jest chet voi
    // "SyntaxError: Unexpected token '.'". Da vap dung loi do.
    //
    // Jest khong doc duoc CSS (Next/webpack co loader rieng nen san pham khong
    // sao). CopilotDockProvider nap ca hai file CSS bang import DONG trong
    // effect, nen moi test mount dock deu cham vao chung.
    "\\.(css|scss|sass)$": "<rootDir>/test/style-mock.js",
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  // tsconfig.json has "jsx": "preserve" (required for Next.js's own build
  // pipeline) — ts-jest with that setting leaves JSX untouched, and this repo
  // has no babel-jest step to compile it afterwards, so any literal JSX in a
  // .tsx test fails with "Unexpected token '<'". Override just for the test
  // transform so component tests can render JSX directly.
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }],
  },
};
