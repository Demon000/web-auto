set -e

protoc \
    --plugin=../node_modules/.bin/protoc-gen-es \
    --es_out . \
    --es_opt target=ts \
    ./src/protos.proto

protoc \
    --plugin=../node_modules/.bin/protoc-gen-es \
    --es_out . \
    --es_opt target=ts \
    ./src/bluetooth.proto
