# One-shot deployer: compiles and deploys AsgardVault to the local chain.
# Build context: repository root.
FROM node:22-alpine
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @asgard/contracts...
COPY packages/contracts packages/contracts
WORKDIR /repo/packages/contracts
# Compile at build time so `docker compose up` doesn't download solc on every start.
RUN pnpm hardhat compile
CMD ["pnpm", "hardhat", "run", "scripts/deploy.ts", "--network", "localhost"]
