npx pbjs -t static-module -w commonjs -o dist/index.js src/*
npx pbts -o dist/index.d.ts dist/index.js
