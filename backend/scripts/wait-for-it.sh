#!/usr/bin/env bash
# wait-for-it.sh: Wait for service to be available before starting

set -e

host="$1"
port="$2"
shift 2
cmd="$@"

until nc -z "$host" "$port"; do
  >&2 echo "Service $host:$port is unavailable - sleeping"
  sleep 1
done

>&2 echo "Service $host:$port is available - executing command"
exec $cmd
