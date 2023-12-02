set -e

mkdir -p ./dist/esm
npx pbjs -t static-module -w es6 -o dist/esm/index.js src/*

npx pbts -o dist/esm/index.d.ts dist/esm/index.js

sed -i '2d' dist/esm/index.js
sed -i '2s@^@import $protobuf from "protobufjs/minimal.js";@' dist/esm/index.js
