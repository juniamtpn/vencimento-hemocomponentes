/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: { module: "commonjs" } }],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "lib/file-parser.ts",
    "lib/pdf-parser.ts",
    "lib/sheets-parser.ts",
    "lib/google-drive.ts",
    "lib/processar-vencimentos.ts",
    "app/api/cron/processar-vencimentos/route.ts",
    "app/api/processar/route.ts",
    "app/api/envios/upload-manual/route.ts",
  ],
};

module.exports = config;
