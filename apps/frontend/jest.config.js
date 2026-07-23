/** @type {import('ts-jest').JestConfigWithTsJest} */
/** Minimal jest config — unit test cho lib/ + component (jsdom). */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
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
