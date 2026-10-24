FROM scratch AS context-audit
COPY . /context/

FROM node:24.18.1-bookworm-slim AS web
WORKDIR /build
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/capture-web/package.json packages/capture-web/
COPY packages/receipt-verifier/package.json packages/receipt-verifier/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY packages/capture-web/tsconfig*.json packages/capture-web/
COPY packages/capture-web/src packages/capture-web/src
COPY packages/receipt-verifier/tsconfig*.json packages/receipt-verifier/
COPY packages/receipt-verifier/src packages/receipt-verifier/src
COPY apps/web/index.html apps/web/tsconfig.json apps/web/vite.config.ts apps/web/
COPY apps/web/src apps/web/src
COPY apps/web/public apps/web/public
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0.402 AS api
WORKDIR /build
COPY Directory.Build.props global.json ./
COPY src/CaptureProof.Api/CaptureProof.Api.csproj src/CaptureProof.Api/packages.lock.json src/CaptureProof.Api/
RUN dotnet restore src/CaptureProof.Api --locked-mode
COPY src/CaptureProof.Api/*.cs src/CaptureProof.Api/appsettings.json src/CaptureProof.Api/
COPY src/CaptureProof.Api/Migrations src/CaptureProof.Api/Migrations
COPY src/CaptureProof.Api/wwwroot src/CaptureProof.Api/wwwroot
COPY --from=web /build/apps/web/dist apps/web/dist
RUN dotnet publish src/CaptureProof.Api -c Release --no-restore -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0.13 AS runtime
WORKDIR /app
COPY --from=api /out ./
RUN mkdir /data && chown app:app /data
ENV CaptureProof__DataDirectory=/data
USER app
VOLUME ["/data"]
EXPOSE 7443
ENTRYPOINT ["dotnet", "CaptureProof.Api.dll"]
