#!/bin/bash

# Set error handling
set -e  # Exit on any error
set -u  # Exit on undefined variable

# Check if country code is provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 <country_code>"
    echo "Example: $0 se"
    exit 1
fi

COUNTRY_CODE="$1"

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verify build directory exists
if [ ! -d "build/$COUNTRY_CODE" ]; then
    echo -e "${RED}No build directory found for $COUNTRY_CODE${NC}"
    echo "Please run ./build_all.sh $COUNTRY_CODE first"
    exit 1
fi

# Ask for confirmation before production deployment
echo -e "${RED}WARNING: You are about to deploy to PRODUCTION for $COUNTRY_CODE${NC}"
read -p "Are you sure? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 1
fi

# Deploy to production
echo -e "${BLUE}Deploying to production...${NC}"
if firebase deploy --only hosting:${COUNTRY_CODE}prod; then
    echo -e "${GREEN}Successfully deployed to production!${NC}"
else
    echo -e "${RED}Failed to deploy to production${NC}"
    exit 1
fi