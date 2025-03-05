#!/bin/bash

# ensure-node-version.sh
# This script ensures that the correct Node.js version (as specified in .nvmrc) is being used
# It will attempt to switch to the required version using nvm if available

set -e  # Exit immediately if a command exits with a non-zero status

# Define colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if .nvmrc exists
if [ ! -f ".nvmrc" ]; then
  echo -e "${RED}Error: .nvmrc file not found in the current directory.${NC}"
  echo "Please create an .nvmrc file with the required Node.js version."
  exit 1
fi

# Try to load nvm if it's not already available
if [ -z "$(command -v nvm)" ]; then
  # Common locations for nvm
  if [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
  elif [ -f "/usr/local/opt/nvm/nvm.sh" ]; then
    source "/usr/local/opt/nvm/nvm.sh"
  elif [ -f "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
  else
    # Check if we can at least use the node command
    if [ -z "$(command -v node)" ]; then
      echo -e "${RED}Neither nvm nor node is available in the current environment.${NC}"
      echo "Please ensure Node.js v$(cat .nvmrc) is installed and available."
      exit 1
    else
      # If node is available but not nvm, just check the version
      REQUIRED_VERSION=$(cat .nvmrc)
      CURRENT_VERSION=$(node -v | sed 's/v//')
      
      if [[ "$CURRENT_VERSION" != "$REQUIRED_VERSION"* ]]; then
        echo -e "${YELLOW}Warning: You are using Node.js v$CURRENT_VERSION, but this project requires v$REQUIRED_VERSION.${NC}"
        echo "Please switch to Node.js v$REQUIRED_VERSION manually."
        exit 1
      else
        echo -e "${GREEN}Using Node.js v$CURRENT_VERSION${NC}"
        exit 0
      fi
    fi
  fi
fi

# If we get here, nvm should be available
if [ -z "$(command -v nvm)" ]; then
  echo -e "${RED}Failed to load nvm.${NC}"
  echo "Please ensure nvm is properly installed."
  exit 1
fi

# Read the required Node.js version from .nvmrc
REQUIRED_VERSION=$(cat .nvmrc)

# Get the current Node.js version
CURRENT_VERSION=$(node -v 2>/dev/null | sed 's/v//' || echo "none")

# Check if the current version starts with the required version
if [[ "$CURRENT_VERSION" != "$REQUIRED_VERSION"* ]]; then
  echo -e "${YELLOW}Switching to Node.js version $REQUIRED_VERSION...${NC}"
  
  # Temporarily unset npm_config_prefix if it's set
  if [ -n "$npm_config_prefix" ]; then
    OLD_NPM_CONFIG_PREFIX=$npm_config_prefix
    unset npm_config_prefix
    echo "Temporarily unset npm_config_prefix for nvm compatibility"
  fi
  
  # Check if the required version is installed
  if ! nvm ls "$REQUIRED_VERSION" > /dev/null 2>&1; then
    echo -e "${YELLOW}Node.js v$REQUIRED_VERSION is not installed. Installing now...${NC}"
    nvm install "$REQUIRED_VERSION"
    if [ $? -ne 0 ]; then
      echo -e "${RED}Failed to install Node.js v$REQUIRED_VERSION.${NC}"
      exit 1
    fi
  fi
  
  # Try to use nvm
  nvm use "$REQUIRED_VERSION"
  NVM_STATUS=$?
  
  # Restore npm_config_prefix if it was set
  if [ -n "$OLD_NPM_CONFIG_PREFIX" ]; then
    export npm_config_prefix=$OLD_NPM_CONFIG_PREFIX
    echo "Restored npm_config_prefix"
  fi
  
  # Check if nvm use was successful
  if [ $NVM_STATUS -ne 0 ]; then
    echo -e "${RED}Failed to switch to Node.js version $REQUIRED_VERSION.${NC}"
    echo "Please run 'nvm install $REQUIRED_VERSION' and try again."
    exit 1
  fi
  
  # Verify the switch was successful
  NEW_VERSION=$(node -v | sed 's/v//')
  if [[ "$NEW_VERSION" != "$REQUIRED_VERSION"* ]]; then
    echo -e "${RED}Failed to switch to Node.js version $REQUIRED_VERSION.${NC}"
    echo "Please run 'nvm install $REQUIRED_VERSION' and try again."
    exit 1
  fi
  
  echo -e "${GREEN}Successfully switched to Node.js version $NEW_VERSION${NC}"
  
  # Only rebuild if we actually switched versions
  if [ "$CURRENT_VERSION" != "none" ]; then
    echo "Rebuilding dependencies..."
    npm rebuild
    echo -e "${GREEN}Done!${NC}"
  fi
else
  echo -e "${GREEN}Already using Node.js version $CURRENT_VERSION${NC}"
fi 