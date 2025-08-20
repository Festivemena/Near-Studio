![NearSmart Banner](./nearstudio-light.png#gh-light-mode-only)
![NearSmart Banner](./nearstudio-dark.png#gh-dark-mode-only)

# Near Smart Contracts VS Code Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/Festivemena/Near-Studio.svg?style=social&label=Star)](https://github.com/Festivemena/Near-Studio)
[![GitHub forks](https://img.shields.io/github/forks/Festivemena/Near-Studio.svg?style=social&label=Fork)](https://github.com/Festivemena/Near-Studio/fork)
[![GitHub issues](https://img.shields.io/github/issues/Festivemena/Near-Studio.svg)](https://github.com/Festivemena/Near-Studio/issues)
[![Contributors](https://img.shields.io/github/contributors/Festivemena/Near-Studio.svg)](https://github.com/Festivemena/Near-Studio/graphs/contributors)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

A comprehensive VS Code extension for developing, building, testing, and deploying Near Protocol smart contracts in **Rust**, **JavaScript**, **TypeScript**, and **AssemblyScript**.

## Features

- **Multi-language support**: Create contracts in Rust, JavaScript, TypeScript, and AssemblyScript
- **Smart contract templates**: Quick scaffolding with best practices for all languages
- **Advanced build systems**: Language-specific optimized build configurations
- **Cross-language testing**: Comprehensive testing support for all contract types
- **Deployment automation**: Easy deployment to testnet/mainnet with environment management
- **Rich code snippets**: Extensive snippet libraries for common patterns in all languages
- **Task integration**: Built-in VS Code tasks for Near operations
- **Toolchain management**: Automated setup for Rust, AssemblyScript, and Node.js environments
- **Contract optimization**: Production-ready optimization for WASM outputs
- **Binding generation**: Generate client bindings for contract interaction

## Installation

### Prerequisites

Before using this extension, ensure you have the following installed:

1. **Node.js** (v16 or higher)
2. **Near CLI**:
   ```bash
   npm install -g near-cli
   ```

#### For Rust Contracts:
3. **Rust** with WASM target:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup target add wasm32-unknown-unknown
   cargo install cargo-near
   ```

#### For AssemblyScript Contracts:
4. **AssemblyScript** tools:
   ```bash
   npm install -g assemblyscript
   npm install -g as-pect
   ```

### Building the Extension

1. Clone this repository:
   ```bash
   git clone <your-repo-url>
   cd near-vscode-extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile the TypeScript:
   ```bash
   npm run compile
   ```

4. Package the extension:
   ```bash
   npm install -g vsce
   vsce package
   ```

5. Install the generated `.vsix` file in VS Code:
   - Open VS Code
   - Go to Extensions view (Ctrl+Shift+X)
   - Click the "..." menu and select "Install from VSIX..."
   - Select the generated `.vsix` file

## Usage

### Getting Started

1. **Open a workspace** in VS Code
2. **Initialize a Near project**:
   - Open Command Palette (Ctrl+Shift+P)
   - Run "Near: Initialize Near Project"
   - Choose between Rust, JavaScript, TypeScript, or AssemblyScript

3. **Create a new contract**:
   - Run "Near: Create New Near Contract"
   - Choose contract language and template
   - Enter contract name

### Available Commands

All commands can be accessed via the Command Palette (Ctrl+Shift+P):

#### Contract Creation
- `Near: Create New Near Contract` - Interactive contract creation wizard
- `Near: Create Rust Contract` - Create Rust smart contract
- `Near: Create JavaScript Contract` - Create JavaScript smart contract  
- `Near: Create TypeScript Contract` - Create TypeScript smart contract
- `Near: Create AssemblyScript Contract` - Create AssemblyScript smart contract

#### Development & Build
- `Near: Build Contract` - Build the current contract (auto-detects language)
- `Near: Test Contract` - Run contract tests
- `Near: Optimize Contract` - Build optimized production version
- `Near: Generate Bindings` - Generate client interaction code

#### Deployment & Management
- `Near: Deploy Contract` - Deploy to Near network
- `Near: Initialize Near Project` - Set up new Near project

#### Toolchain Setup
- `Near: Setup Rust Toolchain` - Install Rust development tools
- `Near: Setup AssemblyScript Toolchain` - Install AssemblyScript tools

### Configuration

Configure the extension in VS Code settings:

```json
{
  "nearExtension.network": "testnet",
  "nearExtension.accountId": "your-account.testnet",
  "nearExtension.buildCommand": "cargo build --target wasm32-unknown-unknown --release",
  "nearExtension.asBuildCommand": "npm run asbuild",
  "nearExtension.jsBuildCommand": "npm run build",
  "nearExtension.wasmOptimization": true,
  "nearExtension.autoInstallDeps": true
}
```

### Language-Specific Features

#### Rust Contracts
- **Full near-sdk-rs support** with latest features
- **Optimized build configurations** for production deployments
- **Comprehensive testing** with mock blockchain environment
- **Advanced snippets** for storage, cross-contract calls, and testing
- **Automatic toolchain validation** and setup assistance

**Snippet Examples:**
- `near-contract` - Complete contract structure
- `near-view` - View method
- `near-call` - Change method
- `near-payable` - Payable method
- `near-cross-contract` - Cross-contract calls
- `near-test` - Test module setup

#### JavaScript/TypeScript Contracts
- **Type-safe development** with full TypeScript support
- **Modern ES6+ syntax** with near-sdk-js
- **Integrated testing** with Jest
- **Rich type definitions** for all Near primitives
- **Advanced error handling** and validation

**Snippet Examples:**
- `near-contract-js/ts` - Contract class structure
- `near-view-js/ts` - Typed view methods
- `near-call-js/ts` - Typed call methods
- `near-storage-js/ts` - Storage collections
- `near-cross-contract-js/ts` - Promise-based cross-contract calls

#### AssemblyScript Contracts
- **WebAssembly-optimized** development experience
- **High-performance contracts** with low gas costs
- **Complete near-sdk-as integration**
- **Advanced testing** with as-pect framework
- **Memory-efficient** storage patterns

**Snippet Examples:**
- `near-contract-as` - AssemblyScript contract structure
- `near-view-as` - View functions
- `near-call-as` - Change functions
- `near-payable-as` - Payable functions
- `near-storage-as` - Persistent storage collections
- `near-test-as` - Test suite setup

### Project Structures

#### Rust Contract
```
my-rust-contract/
├── Cargo.toml              # Rust package configuration
├── rust-toolchain.toml     # Rust toolchain specification
├── src/
│   └── lib.rs             # Main contract code
├── build.sh               # Build script
├── optimize.sh            # Production optimization
├── deploy.sh              # Deployment script
└── target/                # Build artifacts
```

#### JavaScript/TypeScript Contract
```
my-js-contract/
├── package.json           # NPM package configuration
├── tsconfig.json          # TypeScript configuration (TS only)
├── jest.config.json       # Test configuration
├── src/
│   └── index.js/ts       # Main contract code
├── build/                 # WASM output
├── build.sh              # Build script
└── deploy.sh             # Deployment script
```

#### AssemblyScript Contract
```
my-as-contract/
├── package.json           # NPM package configuration
├── asconfig.json          # AssemblyScript configuration
├── as-pect.config.js      # Test configuration
├── assembly/
│   ├── index.ts          # Main contract code
│   └── __tests__/        # Test files
├── build/                 # WASM output
├── build.sh              # Build script
└── deploy.sh             # Deployment script
```

### Advanced Features

#### Contract Optimization
The extension provides language-specific optimization:

- **Rust**: Uses `wasm-opt` with aggressive size optimization
- **JavaScript/TypeScript**: Minimizes and optimizes with near-sdk-js compiler
- **AssemblyScript**: Leverages AssemblyScript's built-in optimization levels

#### Automated Testing
- **Unit testing** for all contract functions
- **Integration testing** with mock Near environment
- **Gas profiling** and performance analysis
- **Continuous integration** setup templates

#### Deployment Management
- **Multi-network support** (testnet, mainnet, localnet)
- **Environment variable management**
- **Automated account creation** assistance
- **Contract state migration** helpers

## Development

### Setting up Development Environment

1. Clone the repository
2. Install dependencies: `npm install`
3. Open in VS Code
4. Press F5 to launch Extension Development Host

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Testing

Run tests with:
```bash
npm test
```

## Troubleshooting

### Common Issues

1. **"cargo: command not found"**
   - Install Rust: https://rustup.rs/
   - Add to PATH and restart VS Code

2. **"near: command not found"**
   - Install Near CLI: `npm install -g near-cli`
   - Restart terminal/VS Code

3. **"wasm32-unknown-unknown target not found"**
   - Add target: `rustup target add wasm32-unknown-unknown`

4. **AssemblyScript build failures**
   - Install AssemblyScript: `npm install -g assemblyscript`
   - Check asconfig.json configuration

5. **TypeScript compilation errors**
   - Ensure TypeScript is installed: `npm install -g typescript`
   - Check tsconfig.json settings

### Language-Specific Debugging

#### Rust
- Use `cargo check` for fast syntax checking
- Enable debug symbols for testing: `cargo build --target wasm32-unknown-unknown`
- Use `RUST_BACKTRACE=1` for detailed error traces

#### JavaScript/TypeScript
- Enable source maps in near-sdk-js build
- Use VS Code debugger with Node.js configuration
- Check browser console for runtime errors

#### AssemblyScript
- Use `--debug` flag for development builds
- Enable source maps in asconfig.json
- Use as-pect for comprehensive testing

### Performance Optimization

#### Contract Size Optimization
- **Rust**: Use `opt-level = "z"` and LTO
- **JS/TS**: Minimize dependencies and use tree-shaking
- **AssemblyScript**: Enable optimization flags and use `--optimize`

#### Gas Optimization
- Minimize storage operations
- Use efficient data structures
- Batch operations when possible
- Profile gas usage with Near tools

## Roadmap

- [ ] **Advanced debugging** support for all languages
- [ ] **Visual contract designer** with drag-and-drop interface
- [ ] **Real-time gas profiling** and optimization suggestions
- [ ] **Contract security analysis** and vulnerability detection
- [ ] **Multi-contract project** management
- [ ] **Near Workspaces integration** for complex testing scenarios
- [ ] **Contract upgradeability** patterns and helpers
- [ ] **Integration with Near indexing** services
- [ ] **Visual state exploration** and debugging tools
- [ ] **Automated contract auditing** and best practice validation

## License

MIT License - see LICENSE file for details.

## Contributing

We welcome contributions! Please see our contributing guidelines and code of conduct.

## Support

- **Documentation**: https://docs.near.org/
- **Discord**: https://discord.gg/nearprotocol
- **Issues**: Report on GitHub repository
- **Discussions**: GitHub Discussions for feature requests
 Call method
- `near-payable` - Payable method
- `near-init` - Initialization method
- `near-assert-owner` - Owner assertion
- `near-storage` - Storage collections
- `near-cross-contract` - Cross-contract calls
- `near-test` - Test module

#### JavaScript/TypeScript Snippets
- `near-contract-js` - Basic JS contract
- `near-contract-ts` - Basic TS contract
- `near-view-js` - View method
- `near-call-js` - Call method
- `near-payable-js` - Payable method
- `near-init-js` - Initialization method
- `near-assert-owner-js` - Owner assertion
- `near-storage-js` - Storage collections
- `near-cross-contract-js` - Cross-contract calls

### Project Structure

#### Rust Contract Structure
```
my-contract/
├── Cargo.toml
├── src/
│   └── lib.rs
├── build.sh
└── target/
```

#### JavaScript/TypeScript Contract Structure
```
my-contract/
├── package.json
├── src/
│   └── index.js (or index.ts)
├── build/
└── node_modules/
```

## Development

### Setting up Development Environment

1. Clone the repository
2. Install dependencies: `npm install`
3. Open in VS Code
4. Press F5 to launch Extension Development Host

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Testing

Run tests with:
```bash
npm test
```

## Troubleshooting

### Common Issues

1. **"cargo: command not found"**
   - Make sure Rust is installed and in your PATH
   - Restart VS Code after installing Rust

2. **"near: command not found"**
   - Install Near CLI: `npm install -g near-cli`
   - Restart your terminal/VS Code

3. **"wasm32-unknown-unknown target not found"**
   - Add the target: `rustup target add wasm32-unknown-unknown`

4. **Build failures**
   - Check that all dependencies are installed
   - Verify your Rust/Node.js versions
   - Check the VS Code output panel for detailed error messages

### Getting Help

- Check the [Near Documentation](https://docs.near.org/)
- Visit the [Near Discord](https://discord.gg/nearprotocol)
- Report issues on the GitHub repository

## Roadmap

- [ ] Debugging support for smart contracts
- [ ] Integration with Near Explorer
- [ ] Contract interaction testing tools
- [ ] Gas profiling and optimization hints
- [ ] Integration with Near Workspaces
- [ ] Smart contract security analysis
- [ ] Contract upgradeability helpers

## License

MIT License - see LICENSE file for details.