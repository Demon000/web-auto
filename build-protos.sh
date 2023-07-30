npx pbjs -t static-module -w commonjs -o src/proto/types/index.js src/proto/protos/*
npx pbts -o src/proto/types/index.d.ts src/proto/types/index.js
