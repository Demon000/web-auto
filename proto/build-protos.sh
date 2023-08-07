npx pbjs -t static-module -w commonjs -o types/index.js protos/*
npx pbts -o types/index.d.ts types/index.js
