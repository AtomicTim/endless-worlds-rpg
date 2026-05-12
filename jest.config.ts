import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  // Exclude .claude/ entirely from jest discovery. The worktree
  // subtree under .claude/worktrees keeps stale snapshots of the test
  // files that conflict with the live repo's copies (and sometimes
  // can't be read due to OneDrive sync state).
  testPathIgnorePatterns: ["/node_modules/", "/\\.next/", "/\\.claude/"],
  modulePathIgnorePatterns: ["/\\.claude/"],
};

export default config;
