set -e

mkdir -p ./dist
npx pbjs -t static-module -w commonjs -o dist/index.js src/*

mkdir -p ./dist/esm
npx pbjs -t static-module -w es6 -o dist/esm/index.js src/*

npx pbts -o dist/index.d.ts dist/index.js
