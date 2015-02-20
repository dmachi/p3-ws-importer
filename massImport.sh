#!/bin/sh

BASE=$1
echo -n Importing $BASE

for NAME in `ls -1 $BASE`; do
	./import.js --path $BASE/$NAME/home --workspace /$NAME/home --admin true --owner $NAME
done;
