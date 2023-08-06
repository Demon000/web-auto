npx pbjs -t static-module -w commonjs -o proto/types/index.js proto/protos/*
npx pbts -o proto/types/index.d.ts proto/types/index.js
