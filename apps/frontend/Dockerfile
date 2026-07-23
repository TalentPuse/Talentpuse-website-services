FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_BASE=""
ARG NEXT_PUBLIC_DOMAIN=""
# Next.js inline hoa NEXT_PUBLIC_* luc build, nen 2 kill-switch nay phai co mat
# o build stage — dat chung o runtime environment thi khong co tac dung.
# Mac dinh rong = tat (lib/flags.ts chi bat khi === "1"), nen CI/CD khong doi.
ARG NEXT_PUBLIC_AI_HOME=""
ARG NEXT_PUBLIC_COPILOT_DOCK=""
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_DOMAIN=$NEXT_PUBLIC_DOMAIN
ENV NEXT_PUBLIC_AI_HOME=$NEXT_PUBLIC_AI_HOME
ENV NEXT_PUBLIC_COPILOT_DOCK=$NEXT_PUBLIC_COPILOT_DOCK
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 8002
ENV PORT=8002
CMD ["node", "server.js"]
