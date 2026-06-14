#!/bin/bash
set -e

source "$(dirname "$0")/.env"

echo "Deploying MantleTap contracts..."
~/.foundry/bin/forge script script/Deploy.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY"
