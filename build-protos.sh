protoc --proto_path='./src/proto/protos' \
       --plugin='./node_modules/.bin/protoc-gen-ts_proto' \
       --ts_proto_opt=esModuleInterop=true \
       --ts_proto_opt=forceLong=bigint \
       --ts_proto_out='./src/proto/types' \
       ./src/proto/protos/*
