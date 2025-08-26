![NearSmart Banner](./nearstudio-dark.png#gh-dark-mode-only)

# Near Smart Contracts VS Code Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/Festivemena/Near-Studio.svg?style=social&label=Star)](https://github.com/Festivemena/Near-Studio)
[![GitHub forks](https://img.shields.io/github/forks/Festivemena/Near-Studio.svg?style=social&label=Fork)](https://github.com/Festivemena/Near-Studio/fork)
[![GitHub issues](https://img.shields.io/github/issues/Festivemena/Near-Studio.svg)](https://github.com/Festivemena/Near-Studio/issues)
[![Contributors](https://img.shields.io/github/contributors/Festivemena/Near-Studio.svg)](https://github.com/Festivemena/Near-Studio/graphs/contributors)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

A comprehensive VS Code extension for developing, building, testing, and deploying Near Protocol smart contracts in **Rust**, **JavaScript** and **Typescript**

## Features

- **Multi-language support**: Create contracts in Rust, JavaScript, and TypeScript
- **Smart contract templates**: Quick scaffolding with best practices for all languages
- **Advanced build systems**: Language-specific optimized build configurations
- **Cross-language testing**: Comprehensive testing support for all contract types
- **Deployment automation**: Easy deployment to testnet/mainnet with environment management
- **Rich code snippets**: Extensive snippet libraries for common patterns in all languages
- **Task integration**: Built-in VS Code tasks for Near operations
- **Toolchain management**: Automated setup for Rust, and Node.js environments
- **Contract optimization**: Production-ready optimization for WASM outputs
- **Binding generation**: Generate client bindings for contract interaction
- **Account Manager**: Create and import Mainnet/Testnet accounts with 1-click

### 🎛️ **Integrated Sidebar Panel**
- **Project Explorer**: Quick-access buttons for contract creation, building, and deployment
- **Contract Manager**: Automatic detection and status tracking of NEAR contracts in your workspace
- **Account Manager**: Manage NEAR accounts with easy configuration, get gas for testnet and switching accounts

### 🔧 **Developer Experience**
- **Task integration**: Built-in VS Code tasks for Near operations
- **Toolchain management**: Automated setup for Rust and Node.js environments
- **Contract optimization**: Production-ready optimization for WASM outputs
- **Binding generation**: Generate client bindings for contract interaction
- **File system watchers**: Auto-refresh contract list when files change

## Installation

### Prerequisites

Before using this extension, ensure you have the following installed:

1. **Node.js** (v16 or higher)
2. **Near CLI RS**:
   ```bash
   cargo install near-cli-rs 
   ```

#### For Rust Contracts:
3. **Rust** with WASM target:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup target add wasm32-unknown-unknown
   cargo install cargo-near
   cargo install near-cli-rs
   ```


### Installing the Extension

**From VS Code Marketplace** (Recommended):
1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Search for "Near Studio"
4. Click Install

**Manual Installation**:
1. Download the latest `.vsix` file from [Releases](https://github.com/Festivemena/Near-Studio/releases)
2. In VS Code, go to Extensions view (Ctrl+Shift+X)
3. Click the "..." menu and select "Install from VSIX..."
4. Select the downloaded `.vsix` file

## Usage

### Getting Started with the Sidebar

1. **Open the NEAR Studio Sidebar**:
- Click the NEAR Studio icon in the Activity Bar (left sidebar)
- Or use Command Palette: "View: Show Near Studio"

2. **Project Explorer Panel**:
- Click "🚀 Create New Contract" for quick contract creation
- Use "🔨 Build Contract" to build your current contract
- Use "📦 Deploy Contract" for one-click deployment

3. **Contract Manager Panel**:
- Automatically shows all NEAR contracts in your workspace
- Displays contract type (Rust 🦀, JavaScript/TypeScript 📜)
- Shows build status (✅ Built, ⚠️ Not Built)
- Click any contract to open its folder

4. **Account Manager Panel**:
- Click "Add Account" to configure NEAR accounts
- Switch between testnet/mainnet accounts
- View currently configured account


### Available Commands

All commands are accessible via Command Palette (Ctrl+Shift+P) and the sidebar:

#### Contract Creation
- `Near: Create New Near Contract` - Interactive contract creation wizard
- `Near: Create Rust Contract` - Create Rust smart contract
- `Near: Create JavaScript Contract` - Create JavaScript smart contract
- `Near: Create TypeScript Contract` - Create TypeScript smart contract

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



## 🔧 Language-Specific Features

### Rust Contracts 🦀
- **Full near-sdk-rs support** with latest features
- **NEAR CLI RS integration** for modern Rust toolchain
- **Optimized build configurations** for production deployments
- **Comprehensive testing** with mock blockchain environment
- **Advanced snippets** for storage, cross-contract calls, and testing

**Snippet Examples:**
- `near-contract` - Complete contract structure
- `near-view` - View method
- `near-call` - Call method
- `near-payable` - Payable method
- `near-cross-contract` - Cross-contract calls
- `near-test` - Test module setup

### JavaScript/TypeScript Contracts 📜
- **Type-safe development** with full TypeScript support
- **Modern ES6+ syntax** with near-sdk-js
- **Integrated testing** with Jest
- **Rich type definitions** for all NEAR primitives

**Snippet Examples:**
- `near-contract-js/ts` - Contract class structure
- `near-view-js/ts` - Typed view methods
- `near-call-js/ts` - Typed call methods
- `near-storage-js/ts` - Storage collections
- `near-cross-contract-js/ts` - Promise-based cross-contract calls

## 📁 Project Structures

### Rust Contract

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


## 🐛 Troubleshooting

### Common Issues

1. **"cargo: command not found"**
   - Install Rust: https://rustup.rs/
   - Add to PATH and restart VS Code

2. **"near: command not found"**
   - Install NEAR CLI: `npm install -g near-cli`
   - For Rust: Install `cargo install near-cli-rs`
   - Restart terminal/VS Code

3. **Contracts not showing in sidebar**
   - Click the "🔄 Refresh" button in Contract Manager
   - Ensure your project has `Cargo.toml` or `package.json`
   - Check that files contain NEAR-related dependencies

4. **"wasm32-unknown-unknown target not found"**
   - Add target: `rustup target add wasm32-unknown-unknown`

5. **Sidebar not appearing**
   - Click the NEAR Studio icon in the Activity Bar
   - Or use Command Palette: "View: Show Near Studio"

### Language-Specific Debugging

#### Rust
- Use `cargo check` for fast syntax checking
- Enable debug symbols for testing: `cargo build --target wasm32-unknown-unknown`
- Use `RUST_BACKTRACE=1` for detailed error traces

#### JavaScript/TypeScript
- Enable source maps in near-sdk-js build
- Use VS Code debugger with Node.js configuration
- Check browser console for runtime errors

### Performance Optimization

#### Contract Size Optimization
- **Rust**: Use `opt-level = "z"` and LTO
- **JS/TS**: Minimize dependencies and use tree-shaking

#### Gas Optimization
- Minimize storage operations
- Use efficient data structures
- Batch operations when possible
- Profile gas usage with NEAR tools

## 🗺️ Roadmap

- [x] **Integrated sidebar panel** with Project Explorer, Contract Manager, and Account Manager
- [x] **Real-time contract detection** with file system watchers
- [x] **Contract status tracking** (built vs. not built)
- [ ] **Advanced debugging** support for all languages
- [ ] **Visual contract designer** with drag-and-drop interface
- [ ] **Real-time gas profiling** and optimization suggestions
- [ ] **Contract security analysis** and vulnerability detection
- [ ] **Integration with NEAR indexing** services
- [ ] **Automated contract auditing** and best practice validation

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [contributing guidelines](CONTRIBUTING.md) and [code of conduct](CODE_OF_CONDUCT.md).

## 💬 Support

- **Documentation**: https://docs.near.org/
- **Discord**: https://discord.gg/nearprotocol
- **Issues**: [Report on GitHub](https://github.com/Festivemena/Near-Studio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Festivemena/Near-Studio/discussions) for feature requests

---

**🚀 Ready to build the future with NEAR? Install Near Studio and start coding smart contracts with the best developer experience on VS Code!**
