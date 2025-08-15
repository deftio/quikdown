{
  "name": "quikdown",
  "version": "1.0.0",
  "description": "Lightweight, fast markdown parser with XSS protection and plugin support",
  "main": "dist/quikdown.js",
  "module": "dist/quikdown.esm.js",
  "browser": "dist/quikdown.umd.js",
  "types": "dist/quikdown.d.ts",
  "files": [
    "dist",
    "src",
    "LICENSE",
    "README.md"
  ],
  "scripts": {
    "build": "rollup -c",
    "dev": "rollup -c -w",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.js",
    "format": "prettier --write 'src/**/*.js'",
    "prepublishOnly": "npm run build && npm test"
  },
  "keywords": [
    "markdown",
    "parser",
    "lightweight",
    "xss",
    "sanitization",
    "commonmark",
    "plugin",
    "extensible",
    "browser",
    "node"
  ],
  "author": "DeftIO",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/deftio/quikdown.git"
  },
  "bugs": {
    "url": "https://github.com/deftio/quikdown/issues"
  },
  "homepage": "https://github.com/deftio/quikdown#readme",
  "devDependencies": {
    "@rollup/plugin-node-resolve": "^15.0.0",
    "@rollup/plugin-terser": "^0.4.0",
    "eslint": "^8.50.0",
    "jest": "^29.7.0",
    "prettier": "^3.0.0",
    "rollup": "^4.0.0"
  },
  "jest": {
    "testEnvironment": "jsdom",
    "collectCoverageFrom": [
      "src/**/*.js"
    ],
    "coverageDirectory": "coverage",
    "coverageReporters": [
      "text",
      "lcov",
      "html"
    ]
  },
  "engines": {
    "node": ">=14.0.0"
  },
  "browserslist": [
    "> 1%",
    "last 2 versions",
    "not dead"
  ]
}