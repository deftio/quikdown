import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the package.json file
const packageJsonPath = path.join(__dirname, '../package.json');

// Path to the quikdown_version.js file
const versionFilePath = path.join(__dirname, '../src/quikdown_version.js');

// Update the version file from package.json
async function updateVersion() {
  try {
    // Read the package.json file
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const version = packageJson.version;

    // Generate the version module content
    const versionFileContent = `// Auto-generated version file - DO NOT EDIT MANUALLY
// This file is automatically updated by tools/updateVersion.js

export const quikdownVersion = "${version}";

export default quikdownVersion;`;

    // Write the version file
    await fs.writeFile(versionFilePath, versionFileContent, 'utf8');

    console.log(`Updated quikdown_version.js to version ${version}`);
  } catch (error) {
    console.error('Error updating version:', error);
    process.exit(1);
  }
}

updateVersion();