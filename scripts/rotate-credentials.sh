#!/bin/bash

# Script to help rotate credentials safely

# Set colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}==== Credential Rotation Assistant ====${NC}"
echo "This script will help you update credentials securely."

# Ask which credentials to rotate
echo -e "\n${BLUE}Which credentials would you like to rotate?${NC}"
echo "1) OpenAI API Key"
echo "2) Azure Client Credentials" 
echo "3) All credentials"
read -p "Enter option (1-3): " OPTION

# Backup the current .env file
TIMESTAMP=$(date +%Y%m%d%H%M%S)
ENV_BACKUP=".env.backup.$TIMESTAMP"
cp .env $ENV_BACKUP
echo -e "${GREEN}✓ Current .env backed up to $ENV_BACKUP${NC}"

# Function to get new credential value
get_new_credential() {
  local name=$1
  echo -e "\n${YELLOW}Enter the new $name:${NC}"
  read -s NEW_VALUE
  echo
  echo -e "${YELLOW}Confirm the new $name:${NC}"
  read -s CONFIRM_VALUE
  echo
  
  if [ "$NEW_VALUE" != "$CONFIRM_VALUE" ]; then
    echo -e "${RED}Values don't match. Please try again.${NC}"
    exit 1
  fi
  
  echo "$NEW_VALUE"
}

# Rotate OpenAI API Key
rotate_openai_key() {
  echo -e "\n${BLUE}Rotating OpenAI API Key...${NC}"
  NEW_KEY=$(get_new_credential "OpenAI API Key")
  sed -i.bak "s|^OPENAI_API_KEY=.*$|OPENAI_API_KEY=$NEW_KEY|" .env
  rm .env.bak
  echo -e "${GREEN}✓ OpenAI API Key updated${NC}"
}

# Rotate Azure Credentials
rotate_azure_credentials() {
  echo -e "\n${BLUE}Rotating Azure Credentials...${NC}"
  
  # Client ID
  echo -e "\n${YELLOW}Updating Client ID...${NC}"
  NEW_CLIENT_ID=$(get_new_credential "Azure Client ID")
  sed -i.bak "s|^NEXT_PUBLIC_AZURE_CLIENT_ID=.*$|NEXT_PUBLIC_AZURE_CLIENT_ID=$NEW_CLIENT_ID|" .env
  sed -i.bak "s|^AZURE_CLIENT_ID=.*$|AZURE_CLIENT_ID=$NEW_CLIENT_ID|" .env
  
  # Tenant ID
  echo -e "\n${YELLOW}Updating Tenant ID...${NC}"
  NEW_TENANT_ID=$(get_new_credential "Azure Tenant ID")
  sed -i.bak "s|^NEXT_PUBLIC_AZURE_TENANT_ID=.*$|NEXT_PUBLIC_AZURE_TENANT_ID=$NEW_TENANT_ID|" .env
  sed -i.bak "s|^AZURE_TENANT_ID=.*$|AZURE_TENANT_ID=$NEW_TENANT_ID|" .env
  
  rm .env.bak
  echo -e "${GREEN}✓ Azure credentials updated${NC}"
}

# Process option
case $OPTION in
  1)
    rotate_openai_key
    ;;
  2)
    rotate_azure_credentials
    ;;
  3)
    rotate_openai_key
    rotate_azure_credentials
    ;;
  *)
    echo -e "${RED}Invalid option. Exiting.${NC}"
    exit 1
    ;;
esac

echo -e "\n${GREEN}==== Credentials rotated successfully ====${NC}"
echo -e "${YELLOW}Remember to update these credentials in any deployment environments.${NC}"
echo -e "${YELLOW}If you suspect credentials were exposed, revoke the old ones.${NC}" 