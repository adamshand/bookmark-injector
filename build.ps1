$ErrorActionPreference = "Stop"

npm ci
npm test
npm run build
node scripts/prepare-firefox.mjs

npx web-ext lint --source-dir dist/firefox
npx web-ext build --source-dir dist/firefox --artifacts-dir web-ext-artifacts --overwrite-dest

echo "✅ Chrome unpacked extension: $PWD"
echo "✅ Firefox package: $PWD/web-ext-artifacts"
