# Node.js Version Requirements

This project requires **Node.js v20 LTS** to run correctly. Using other versions (especially v23+) may cause compatibility issues with dependencies like `better-sqlite3`.

## Automatic Version Checking

The project includes an automatic Node.js version check that runs before `npm run dev`, `npm run build`, and `npm run start`. This check will:

1. Verify you're using Node.js v20
2. Attempt to switch to Node.js v20 using nvm if available
3. Rebuild dependencies if needed

## Manual Version Management

### Using nvm (recommended)

If you have [nvm](https://github.com/nvm-sh/nvm) installed:

```bash
# Switch to Node.js v20
nvm use 20

# If you don't have Node.js v20 installed yet
nvm install 20
nvm use 20
```

### Without nvm

If you're not using nvm, please ensure you have Node.js v20 installed and active when working on this project.

## Troubleshooting

If you encounter errors related to native modules (like `better-sqlite3`), try rebuilding the dependencies:

```bash
npm rebuild
```

For persistent issues, try removing the node_modules directory and reinstalling:

```bash
rm -rf node_modules
npm install
``` 