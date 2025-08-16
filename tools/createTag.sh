#!/bin/bash

# Simple script to create a git tag from package.json version
# Usage: ./tools/createTag.sh

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🏷️  Creating Git Tag from package.json${NC}"
echo "================================"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

echo -e "Current version: ${GREEN}${VERSION}${NC}"
echo -e "Tag to create: ${GREEN}${TAG}${NC}"

# Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo -e "${RED}❌ Error: Tag ${TAG} already exists${NC}"
    echo -e "${YELLOW}Run 'git tag -d ${TAG}' to delete it locally${NC}"
    echo -e "${YELLOW}Run 'git push --delete origin ${TAG}' to delete it remotely${NC}"
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    read -p "Do you want to continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aborted${NC}"
        exit 1
    fi
fi

# Create annotated tag
echo -e "${CYAN}Creating tag ${TAG}...${NC}"
git tag -a "$TAG" -m "Release ${TAG}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tag ${TAG} created successfully!${NC}"
    echo
    echo "Next steps:"
    echo -e "  1. Push the tag: ${CYAN}git push origin ${TAG}${NC}"
    echo -e "  2. Push all tags: ${CYAN}git push --tags${NC}"
    echo -e "  3. Create release on GitHub: ${CYAN}https://github.com/deftio/quikdown/releases/new${NC}"
else
    echo -e "${RED}❌ Failed to create tag${NC}"
    exit 1
fi