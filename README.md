![NearSmart Banner](./assets/nearstudio-dark.png#gh-dark-mode-only)

# Near Studio - VS Code Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.2.2-blue.svg)](https://github.com/Festivemena/Near-Studio/releases)
[![GitHub stars](https://img.shields.io/github/stars/Festivemena/Near-Studio.svg?style=social&label=Star)](https://github.com/Festivemena/Near-Studio)
[![GitHub forks](https://img.shields.io/github/forks/Festivemena/Near-Studio.svg?style=social&label=Fork)](https://github.com/Festivemena/Near-Studio/fork)
[![GitHub issues](https://img.shields.io/github/issues/Festivemena/Near-Studio.svg)](https://github.com/Festivemena/Near-Studio/issues)
[![Contributors](https://img.shields.io/github/contributors/Festivemena/Near-Studio.svg)](https://github.com/Festivemena/Near-Studio/graphs/contributors)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> **The ultimate VS Code extension for NEAR Protocol Rust smart contract development** - streamline your workflow with powerful tools for creating, building, testing, and deploying NEAR smart contracts.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Integrated Sidebar](#integrated-sidebar)
- [Usage Guide](#usage-guide)
- [Available Commands](#available-commands)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

## Features

### 🚀 **Core Capabilities**

- **Rust-First Development**: Optimized for Rust smart contracts using `cargo-near` and modern NEAR tooling
- **Instant Contract Creation**: Create new contracts with automatic workspace and terminal switching
- **One-Click Build & Deploy**: Build and deploy contracts to testnet/mainnet with dropdown options
- **Contract Testing**: Run tests directly from the sidebar with integrated terminal support
- **ABI Parsing & Contract Interface**: Automatically parse deployed contract ABIs and interact with methods via UI
- **Rich Code Snippets**: Extensive Rust snippet library for common NEAR patterns (view/call methods, storage, cross-contract calls, testing)

### 🎛️ **Integrated Sidebar Panels**

#### **Project Explorer**
- **Create New Contract**: One-click Rust contract creation with automatic directory selection
- **Build & Deploy Dropdown**:
  - **Random Account**: Automatically create and deploy to a new random testnet account
  - **Select Account**: Choose from your saved accounts for deployment
- **Run Tests**: Execute `cargo test` with a single click
- **Contract Interface**: After deployment, view and call contract methods through an interactive UI

#### **Contract Manager**
- Automatic detection of all NEAR contracts in your workspace
- Real-time build status tracking (✅ Built / ⚠️ Not Built)
- Contract type identification (🦀 Rust / 📜 JavaScript/TypeScript)
- Click any contract to instantly switch to its directory
- File system watchers for auto-refresh on changes

#### **Account Manager**
- Create new NEAR accounts (mainnet/testnet)
- Quick testnet account creation with automatic faucet funding
- Import existing accounts with private keys or seed phrases
- Switch between multiple configured accounts
- View account balances
- Open accounts in NEAR Explorer
- Network selection (testnet/mainnet)

### 🔧 **Enhanced Developer Experience**

- **Automatic Workspace Switching**: Newly created contracts automatically become your active workspace
- **Terminal Auto-Navigation**: Terminal automatically `cd`s into new contract directories
- **Smart Dependency Checking**: Automatically prompts to install missing tools (`cargo-near`, `near-cli-rs`)
- **Command Palette Integration**: All features accessible via VS Code Command Palette
- **Context Menu Actions**: Right-click file explorer integration for quick actions
- **Task Integration**: Built-in VS Code tasks for NEAR operations

## Installation

### Prerequisites

Before using Near Studio, ensure you have the following installed:

#### Required:
- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **Rust** (latest stable) - [Install via rustup](https://rustup.rs/)
- **cargo-near** - NEAR's Rust contract build tool:
  ```bash
  cargo install cargo-near
  ```
- **near-cli-rs** - Modern NEAR CLI (Rust version):
  ```bash
  cargo install near-cli-rs
  ```

#### Additional Rust Setup:
```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WebAssembly target
rustup target add wasm32-unknown-unknown

# Install NEAR tooling
cargo install cargo-near
cargo install near-cli-rs
```

### Installing the Extension

#### **Option 1: VS Code Marketplace** (Recommended)
1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"Near Studio"**
4. Click **Install**

#### **Option 2: Manual Installation**
1. Download the latest `.vsix` file from [GitHub Releases](https://github.com/Festivemena/Near-Studio/releases)
2. In VS Code, go to Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Click the `...` menu → **"Install from VSIX..."**
4. Select the downloaded `.vsix` file

#### **Option 3: Build from Source**
```bash
git clone https://github.com/Festivemena/Near-Studio.git
cd Near-Studio
npm install
npm run compile
npm run package
# Install the generated .vsix file
```

## Quick Start

### Creating Your First Contract

1. **Open the NEAR Studio Sidebar**
   - Click the NEAR Studio icon in the Activity Bar (left sidebar)
   - Or use Command Palette: `View: Show Near Studio`

2. **Create a New Contract**
   - Click **"🚀 Create New Contract"** in the Project Explorer panel
   - Enter your contract name (e.g., `my-first-contract`)
   - The extension will:
     - Run `cargo near new <project-name>`
     - Automatically open the new contract directory as your workspace
     - Switch the terminal to the contract directory

3. **Build and Deploy**
   - Click **"🔨 Build & Deploy"** dropdown
   - Choose **"Random Account"** for quick testing (creates a new testnet account)
   - Or choose **"Select Account"** to deploy to a saved account

4. **Interact with Your Contract**
   - After deployment, click **"Open Contract Interface"**
   - View and call contract methods through the interactive UI
   - Or use the terminal for manual interactions

### Adding Your First Account

1. Open the **Account Manager** panel in the sidebar
2. Click the **"+"** button
3. Choose:
   - **Quick Create Testnet Account** - Instant testnet account with faucet funding
   - **Create New Account** - Manual account creation
   - **Import Existing Account** - Import via private key or seed phrase

## Integrated Sidebar

### **Project Explorer**

The Project Explorer provides quick-access buttons for common development tasks:

#### 🚀 Create New Contract
- Opens a prompt for contract name
- Validates naming conventions (lowercase, numbers, hyphens, underscores)
- Checks for `cargo-near` installation (prompts to install if missing)
- Runs `cargo near new <project-name>`
- **Automatically opens the new contract directory**
- **Automatically switches terminal to the new directory**

#### 🔨 Build & Deploy (Dropdown)
Two deployment options:

1. **🎲 Random Account**
   - Generates a unique random account name
   - Creates account on testnet with faucet funding
   - Builds and deploys contract automatically
   - Parses contract ABI and opens interactive interface

2. **📋 Select Account**
   - Lists all saved accounts from Account Manager
   - Shows account ID, network, and balance
   - Deploys to selected account
   - Parses contract ABI and opens interactive interface

#### 🧪 Run Tests
- Executes `cargo test` in the current workspace
- Opens terminal to show test results
- Works with any Rust project containing tests

### **Contract Manager**

Automatically detects and manages NEAR contracts in your workspace:

- **Real-time Detection**: Watches for `Cargo.toml`, `package.json`, `asconfig.json`
- **Build Status**: Shows ✅ Built or ⚠️ Not Built based on compiled artifacts
- **Type Identification**: 🦀 Rust, 📜 JavaScript, ⚡ AssemblyScript
- **Quick Navigation**: Click any contract to switch workspace to that directory
- **Auto-Refresh**: File system watchers detect changes automatically
- **Manual Refresh**: 🔄 button to force refresh

### **Account Manager**

Complete account lifecycle management:

#### Adding Accounts
- **Quick Create Testnet Account**: One-click testnet account with faucet
- **Create New Account**: Manual account creation with custom ID
- **Import Existing Account**: Import via private key or seed phrase

#### Account Actions
- **Switch Account**: Set active account for deployments
- **View on Explorer**: Opens account in NEAR Explorer (testnet/mainnet)
- **Balance Display**: Shows NEAR balance for each account
- **Network Badge**: Visual indicator for testnet/mainnet

## Usage Guide

### Working with Contracts

#### Creating a Contract
```
1. Click "🚀 Create New Contract"
2. Enter name: my-contract
3. Wait for cargo near new to complete
4. Workspace automatically opens to my-contract/
5. Terminal is ready at my-contract/ directory
```

#### Building and Deploying
```
1. Click "🔨 Build & Deploy" dropdown
2. Choose deployment method:
   - Random Account: For quick testing
   - Select Account: For specific account deployment
3. Contract builds and deploys automatically
4. Contract interface opens automatically
```

#### Testing Contracts
```
1. Click "🧪 Run Tests"
2. Terminal opens with cargo test output
3. View test results in real-time
```

#### Interacting with Deployed Contracts
After deployment:
1. Click **"Open Contract Interface"** in the notification
2. The Contract Interface webview opens showing:
   - **View Methods** (read-only): Query contract state
   - **Call Methods** (state-changing): Execute transactions
3. Enter parameters as JSON
4. Click **View** or **Call** to execute
5. Results appear in terminal

### Managing Multiple Contracts

1. **View All Contracts**: Contract Manager shows all detected contracts
2. **Switch Between Contracts**: Click any contract card to switch workspace
3. **Track Build Status**: Quickly see which contracts are built
4. **Refresh Detection**: Use 🔄 if new contracts aren't detected

## Available Commands

All commands are accessible via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

### Contract Commands
| Command | Description |
|---------|-------------|
| `Near: Create New Rust Contract` | Create a new Rust smart contract |
| `Near: Build Contract` | Build the current contract with cargo near |
| `Near: Test Contract` | Run contract tests with cargo test |
| `Near: Deploy Contract (Existing Account)` | Deploy to an existing account |
| `Near: Deploy Contract (New Dev Account)` | Deploy to a new random dev account |
| `Near: Setup Rust Toolchain` | Install required Rust tools |

### Account Commands
| Command | Description |
|---------|-------------|
| `Near: Add Account` | Add a new account to the manager |
| `Near: Create New Account` | Create a new NEAR account |
| `Near: Quick Create Testnet Account` | Quick testnet account with faucet |
| `Near: Import Existing Account` | Import account with keys |
| `Near: Switch Account` | Change active account |
| `Near: View Account on Explorer` | Open account in NEAR Explorer |



## Code Snippets

Near Studio includes a comprehensive library of Rust snippets for rapid development:

### Contract Structure Snippets
- `near-contract` - Complete contract structure with imports and basic setup
- `near-init` - Contract initialization method
- `near-default` - Default implementation for contract

### Method Snippets
- `near-view` - View method (read-only)
- `near-call` - Call method (state-changing)
- `near-payable` - Payable method (accepts NEAR tokens)
- `near-private` - Private method

### Storage Snippets
- `near-storage-map` - UnorderedMap storage collection
- `near-storage-set` - UnorderedSet storage collection
- `near-storage-vec` - Vector storage collection
- `near-lazy-option` - LazyOption for large data

### Cross-Contract Calls
- `near-cross-contract` - Cross-contract call setup
- `near-promise` - Promise chaining
- `near-callback` - Callback method

### Testing Snippets
- `near-test` - Complete test module setup
- `near-test-context` - Test context initialization
- `near-test-deposit` - Test with attached deposit

### Example Usage:
Type `near-view` and press `Tab` to generate:
```rust
#[near_bindgen]
impl Contract {
    pub fn method_name(&self) -> ReturnType {
        // TODO: Implement view method
    }
}
```

## Project Structure

### Generated Rust Contract

When you create a new contract, `cargo near new` generates this structure:

```
my-contract/
├── Cargo.toml              # Rust package configuration
├── rust-toolchain.toml     # Rust toolchain specification (if applicable)
├── src/
│   └── lib.rs              # Main contract code
├── tests/
│   └── test_basics.rs      # Integration tests (if generated)
└── target/
    └── near/
        ├── my_contract.wasm    # Compiled contract
        └── my_contract_abi.json # Contract ABI
```

### Key Files:
- **`Cargo.toml`**: Defines dependencies (near-sdk-rs, etc.)
- **`src/lib.rs`**: Your smart contract implementation
- **`target/near/`**: Build outputs created by `cargo near build`


## Troubleshooting

### Common Issues

#### 1. **"cargo: command not found"**
**Problem**: Rust is not installed or not in PATH

**Solution**:
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add to PATH (Linux/Mac)
source $HOME/.cargo/env

# Restart VS Code after installation
```

#### 2. **"cargo-near: command not found"**
**Problem**: cargo-near is not installed

**Solution**:
```bash
cargo install cargo-near

# Restart terminal/VS Code
```

#### 3. **"near-cli-rs: command not found"**
**Problem**: near-cli-rs is not installed

**Solution**:
```bash
cargo install near-cli-rs

# Restart terminal/VS Code
```

#### 4. **Contracts not showing in Contract Manager**
**Problem**: Extension not detecting contracts

**Solutions**:
- Click the **🔄 Refresh** button in Contract Manager
- Ensure your project has `Cargo.toml` (Rust) or `package.json` (JS/TS)
- Check that `Cargo.toml` includes `near-sdk` dependency
- Try closing and reopening VS Code
- Check Output panel: View → Output → "NEAR Studio" for errors

#### 5. **"wasm32-unknown-unknown target not found"**
**Problem**: WebAssembly target not installed

**Solution**:
```bash
rustup target add wasm32-unknown-unknown
```

#### 6. **Contract doesn't deploy**
**Problem**: Various deployment issues

**Solutions**:
- Ensure contract is built: Check `target/near/` directory exists
- Verify account has sufficient balance (testnet: use faucet)
- Check network connectivity
- Verify account credentials are correct
- Review terminal output for specific error messages

#### 7. **Workspace doesn't automatically open after contract creation**
**Problem**: New contract directory not opening

**Solutions**:
- Wait 2-5 seconds for directory creation
- Check terminal for errors during `cargo near new`
- Manually open the contract folder if needed
- Ensure you have write permissions in the workspace directory

#### 8. **Contract Interface shows "ABI not found"**
**Problem**: Contract ABI file not generated

**Solutions**:
- Ensure contract was built with `cargo near build`
- Check `target/near/*.json` file exists
- Rebuild contract and redeploy
- Ensure contract uses `#[near_bindgen]` macro

### Build and Deployment Tips

#### Rust Contract Development
```bash
# Fast syntax checking (no compilation)
cargo check

# Run tests
cargo test

# Build contract
cargo near build

# Deploy to testnet
cargo near deploy --account-id your-account.testnet
```

#### Debugging Build Errors
```bash
# Verbose build output
RUST_BACKTRACE=1 cargo near build

# Clean and rebuild
cargo clean
cargo near build
```

#### Gas Optimization
- Minimize storage reads/writes
- Use efficient data structures (`UnorderedMap`, `Vector`)
- Avoid unnecessary String allocations
- Batch operations when possible
- Test gas usage with `cargo test`

### Performance Tips

- **Use Code Snippets**: Type `near-` and press Tab for quick scaffolding
- **Keep Terminal Open**: Reduces context switching
- **Use Contract Manager**: Quick navigation between multiple contracts
- **Leverage Auto-Refresh**: File watchers detect changes automatically

## Roadmap

### ✅ Completed Features (v0.2.2)
- [x] Integrated sidebar panel with Project Explorer, Contract Manager, and Account Manager
- [x] Real-time contract detection with file system watchers
- [x] Contract build status tracking (built vs. not built)
- [x] Automatic workspace switching for new contracts
- [x] Terminal auto-navigation to contract directories
- [x] Build & Deploy dropdown with random and select account options
- [x] Contract ABI parsing and interactive interface
- [x] Account management with testnet faucet integration
- [x] Comprehensive Rust snippet library
- [x] Context menu integration

## Contributing

We welcome contributions from the community! Here's how you can help:

### Ways to Contribute
- **Report Bugs**: [Open an issue](https://github.com/Festivemena/Near-Studio/issues/new) with details
- **Request Features**: Share your ideas in [GitHub Discussions](https://github.com/Festivemena/Near-Studio/discussions)
- **Submit Pull Requests**: Fork, branch, and submit PRs for review
- **Improve Documentation**: Help us make docs clearer
- **Share Feedback**: Tell us what works and what doesn't

### Development Setup
```bash
# Clone the repository
git clone https://github.com/Festivemena/Near-Studio.git
cd Near-Studio

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes (development)
npm run watch

# Package extension
npm run package
```

### Submitting Pull Requests
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Test thoroughly
5. Commit with clear messages: `git commit -m "Add: feature description"`
6. Push to your fork: `git push origin feature/my-feature`
7. Open a Pull Request with a detailed description

### Code Guidelines
- Follow existing TypeScript conventions
- Add comments for complex logic
- Update README.md if adding features
- Test on Windows, Mac, and Linux if possible

## License

MIT License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Festivemena

## Support & Community

### Documentation
- **NEAR Docs**: [https://docs.near.org/](https://docs.near.org/)
- **near-sdk-rs**: [https://docs.rs/near-sdk/](https://docs.rs/near-sdk/)
- **cargo-near**: [https://github.com/near/cargo-near](https://github.com/near/cargo-near)

### Get Help
- **GitHub Issues**: [Report bugs or request features](https://github.com/Festivemena/Near-Studio/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/Festivemena/Near-Studio/discussions)
- **NEAR Discord**: [https://discord.gg/nearprotocol](https://discord.gg/nearprotocol)

### Stay Updated
- **GitHub Releases**: [Watch for updates](https://github.com/Festivemena/Near-Studio/releases)
- **Star the repo**: Show your support and stay notified

---

## Changelog

### v0.2.2 (Latest)
- Added automatic workspace switching for new contracts
- Added terminal auto-navigation to contract directories
- Improved contract creation workflow
- Enhanced build and deploy features

### v0.2.1
- Stable release with contract testing support
- Added build and deploy to random account feature
- Project Explorer enhancements

### v0.2.0
- Rust-focused release
- Major improvements to cargo-near integration
- Enhanced sidebar panels

### v0.1.3
- Initial stable build
- Basic contract management features

---

<div align="center">

### 🚀 Ready to Build on NEAR?

**Install Near Studio and experience the best NEAR smart contract development workflow in VS Code!**

[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=Festivemena.near-studio) | [View on GitHub](https://github.com/Festivemena/Near-Studio) | [Report Issue](https://github.com/Festivemena/Near-Studio/issues)

Made with ❤️ by [Festivemena](https://github.com/Festivemena) and [contributors](https://github.com/Festivemena/Near-Studio/graphs/contributors)

**Star ⭐ the repo if you find it helpful!**

</div>
