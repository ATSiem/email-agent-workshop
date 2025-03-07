#!/bin/bash

# Read the required Node.js version from .nvmrc
REQUIRED_NODE_VERSION=$(cat .nvmrc)

# Get the current Node.js version
CURRENT_NODE_VERSION=$(node -v)

# Remove the 'v' prefix if present
CURRENT_NODE_VERSION=${CURRENT_NODE_VERSION#v}
REQUIRED_NODE_VERSION=${REQUIRED_NODE_VERSION#v}

# Compare versions
if [[ "$CURRENT_NODE_VERSION" != "$REQUIRED_NODE_VERSION" ]]; then
  echo "Warning: You are using Node.js $CURRENT_NODE_VERSION, but this project requires Node.js $REQUIRED_NODE_VERSION"
  echo "Consider using nvm to switch Node.js versions:"
  echo "  nvm use $REQUIRED_NODE_VERSION"
  echo ""
  # Continue anyway - don't exit with error
fi

exit 0 