# typescript-node-lambda-base

Serverless Framework template for TypeScript Lambda functions on Node.js 20.

## Setup

```sh
npx degit your-user/typescript-node-lambda-base my-service
cd my-service
```

Rename the service in `serverless.yml` and `package.json`, then:

```sh
pnpm install
cp .env.example .env
```

## Scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `pnpm dev`          | Start Serverless Offline on localhost          |
| `pnpm build`        | Package the service (esbuild bundle + minify) |
| `pnpm deploy`       | Deploy to AWS                                 |
| `pnpm test`         | Run tests once (vitest)                       |
| `pnpm test:watch`   | Run tests in watch mode                       |
| `pnpm test:coverage`| Run tests with v8 coverage                    |
| `pnpm lint`         | Lint src and tests with ESLint                |
| `pnpm lint:fix`     | Lint and auto-fix                             |
| `pnpm format`       | Format src and tests with Prettier            |

## Project structure

```
src/
  functions/       # Lambda handlers (one per function)
  services/        # Business logic, one service per function
tests/
  functions/       # Handler tests (mirrors src/)
  services/        # Service tests (mirrors src/)
```

Handlers own the HTTP concerns (status codes, headers, parsing). Services own the logic and return typed responses. Tests mirror the src layout with `.test.ts` suffix.

## Adding a function

1. Create `src/services/thing.service.ts` — export a typed function with your logic.
2. Create `src/functions/thing.ts` — export an async `handler` that calls the service.
3. Add the function entry in `serverless.yml` under `functions:`.
4. Create matching test files in `tests/services/` and `tests/functions/`.
5. Run `pnpm test` to verify.
