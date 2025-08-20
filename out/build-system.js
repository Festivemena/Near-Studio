"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearBuildSystem = void 0;
// Advanced build system for Near contracts
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class NearBuildSystem {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Near Build System');
    }
    async buildContract(config) {
        this.outputChannel.clear();
        this.outputChannel.show();
        this.outputChannel.appendLine(`Building ${config.language} contract: ${config.contractName}`);
        try {
            switch (config.language) {
                case 'rust':
                    return await this.buildRustContract(config);
                case 'javascript':
                case 'typescript':
                    return await this.buildJSContract(config);
                case 'assemblyscript':
                    return await this.buildAssemblyScriptContract(config);
                default:
                    throw new Error(`Unsupported language: ${config.language}`);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`Build failed: ${error}`);
            vscode.window.showErrorMessage(`Build failed: ${error}`);
            return false;
        }
    }
    async buildRustContract(config) {
        const { projectPath, contractName, outputPath, optimization } = config;
        // Ensure rust toolchain is properly set up
        await this.ensureRustToolchain();
        // Build command
        const buildArgs = [
            'build',
            '--target', 'wasm32-unknown-unknown',
            '--release'
        ];
        if (optimization) {
            // Additional optimizations for production
            process.env.RUSTFLAGS = '-C link-arg=-s';
        }
        this.outputChannel.appendLine('Running cargo build...');
        const { stdout, stderr } = await execAsync(`cargo ${buildArgs.join(' ')}`, {
            cwd: projectPath
        });
        if (stderr) {
            this.outputChannel.appendLine(`Warnings: ${stderr}`);
        }
        this.outputChannel.appendLine(stdout);
        // Copy WASM file to output directory
        const wasmSource = path.join(projectPath, 'target', 'wasm32-unknown-unknown', 'release', `${contractName.replace(/-/g, '_')}.wasm`);
        const wasmTarget = path.join(outputPath, `${contractName}.wasm`);
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }
        fs.copyFileSync(wasmSource, wasmTarget);
        // Optimize with wasm-opt if available and optimization is enabled
        if (optimization) {
            await this.optimizeWasm(wasmTarget);
        }
        this.outputChannel.appendLine(`✅ Rust contract built successfully: ${wasmTarget}`);
        return true;
    }
    async buildJSContract(config) {
        const { projectPath, contractName, outputPath, optimization } = config;
        // Ensure dependencies are installed
        if (!fs.existsSync(path.join(projectPath, 'node_modules'))) {
            this.outputChannel.appendLine('Installing dependencies...');
            await execAsync('npm install', { cwd: projectPath });
        }
        // Build the contract
        this.outputChannel.appendLine('Building JavaScript/TypeScript contract...');
        const buildCommand = config.language === 'typescript' ?
            'npm run build:contract' :
            'npm run build:contract';
        const { stdout, stderr } = await execAsync(buildCommand, {
            cwd: projectPath
        });
        if (stderr) {
            this.outputChannel.appendLine(`Warnings: ${stderr}`);
        }
        this.outputChannel.appendLine(stdout);
        // Verify output file exists
        const wasmFile = path.join(projectPath, 'build', `${contractName}.wasm`);
        if (!fs.existsSync(wasmFile)) {
            throw new Error('WASM file not generated');
        }
        // Copy to output directory if different
        if (outputPath !== path.dirname(wasmFile)) {
            if (!fs.existsSync(outputPath)) {
                fs.mkdirSync(outputPath, { recursive: true });
            }
            fs.copyFileSync(wasmFile, path.join(outputPath, `${contractName}.wasm`));
        }
        this.outputChannel.appendLine(`✅ JavaScript/TypeScript contract built successfully: ${wasmFile}`);
        return true;
    }
    async buildAssemblyScriptContract(config) {
        const { projectPath, contractName, outputPath, optimization, debug } = config;
        // Ensure dependencies are installed
        if (!fs.existsSync(path.join(projectPath, 'node_modules'))) {
            this.outputChannel.appendLine('Installing dependencies...');
            await execAsync('npm install', { cwd: projectPath });
        }
        // Build the contract
        this.outputChannel.appendLine('Building AssemblyScript contract...');
        const buildTarget = debug ? 'asbuild:debug' : 'asbuild:release';
        const { stdout, stderr } = await execAsync(`npm run ${buildTarget}`, {
            cwd: projectPath
        });
        if (stderr) {
            this.outputChannel.appendLine(`Warnings: ${stderr}`);
        }
        this.outputChannel.appendLine(stdout);
        // Verify output file exists
        const wasmFile = path.join(projectPath, 'build', debug ? 'debug.wasm' : 'release.wasm');
        if (!fs.existsSync(wasmFile)) {
            throw new Error('WASM file not generated');
        }
        // Copy to output directory with contract name
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }
        const targetWasm = path.join(outputPath, `${contractName}.wasm`);
        fs.copyFileSync(wasmFile, targetWasm);
        // Additional optimization for release builds
        if (optimization && !debug) {
            await this.optimizeWasm(targetWasm);
        }
        this.outputChannel.appendLine(`✅ AssemblyScript contract built successfully: ${targetWasm}`);
        return true;
    }
    async ensureRustToolchain() {
        try {
            // Check if wasm32-unknown-unknown target is installed
            const { stdout } = await execAsync('rustup target list --installed');
            if (!stdout.includes('wasm32-unknown-unknown')) {
                this.outputChannel.appendLine('Installing wasm32-unknown-unknown target...');
                await execAsync('rustup target add wasm32-unknown-unknown');
            }
        }
        catch (error) {
            throw new Error('Rust toolchain not properly configured. Please install Rust and run: rustup target add wasm32-unknown-unknown');
        }
    }
    async optimizeWasm(wasmPath) {
        try {
            // Check if wasm-opt is available
            await execAsync('wasm-opt --version');
            this.outputChannel.appendLine('Optimizing WASM with wasm-opt...');
            const optimizedPath = wasmPath.replace('.wasm', '-optimized.wasm');
            await execAsync(`wasm-opt -Oz "${wasmPath}" --output "${optimizedPath}"`);
            // Replace original with optimized version
            fs.renameSync(optimizedPath, wasmPath);
            this.outputChannel.appendLine('✅ WASM optimization completed');
        }
        catch (error) {
            this.outputChannel.appendLine('⚠️  wasm-opt not available, skipping optimization');
        }
    }
    async runTests(config) {
        this.outputChannel.clear();
        this.outputChannel.show();
        this.outputChannel.appendLine(`Running tests for ${config.language} contract: ${config.contractName}`);
        try {
            let testCommand;
            switch (config.language) {
                case 'rust':
                    testCommand = 'cargo test';
                    break;
                case 'javascript':
                case 'typescript':
                    testCommand = 'npm test';
                    break;
                case 'assemblyscript':
                    testCommand = 'npm run test';
                    break;
                default:
                    throw new Error(`Testing not supported for language: ${config.language}`);
            }
            const { stdout, stderr } = await execAsync(testCommand, {
                cwd: config.projectPath
            });
            if (stderr) {
                this.outputChannel.appendLine(`Test warnings: ${stderr}`);
            }
            this.outputChannel.appendLine(stdout);
            this.outputChannel.appendLine('✅ All tests passed');
            return true;
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Tests failed: ${error}`);
            vscode.window.showErrorMessage(`Tests failed: ${error}`);
            return false;
        }
    }
    async deployContract(config, accountId, network) {
        this.outputChannel.clear();
        this.outputChannel.show();
        this.outputChannel.appendLine(`Deploying ${config.contractName} to ${network} as ${accountId}`);
        try {
            // Determine WASM file path
            let wasmFile;
            switch (config.language) {
                case 'rust':
                case 'javascript':
                case 'typescript':
                    wasmFile = path.join(config.outputPath, `${config.contractName}.wasm`);
                    break;
                case 'assemblyscript':
                    wasmFile = path.join(config.outputPath, `${config.contractName}.wasm`);
                    break;
                default:
                    throw new Error(`Deployment not supported for language: ${config.language}`);
            }
            if (!fs.existsSync(wasmFile)) {
                throw new Error(`WASM file not found: ${wasmFile}. Please build the contract first.`);
            }
            // Deploy using Near CLI
            const deployCommand = `near deploy --wasmFile "${wasmFile}" --accountId ${accountId} --networkId ${network}`;
            this.outputChannel.appendLine(`Executing: ${deployCommand}`);
            const { stdout, stderr } = await execAsync(deployCommand);
            if (stderr) {
                this.outputChannel.appendLine(`Deploy warnings: ${stderr}`);
            }
            this.outputChannel.appendLine(stdout);
            this.outputChannel.appendLine('✅ Contract deployed successfully');
            vscode.window.showInformationMessage(`Contract deployed to ${accountId} on ${network}`);
            return true;
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Deployment failed: ${error}`);
            vscode.window.showErrorMessage(`Deployment failed: ${error}`);
            return false;
        }
    }
    async generateBindings(config, outputDir) {
        this.outputChannel.appendLine(`Generating bindings for ${config.contractName}`);
        // Create bindings directory
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        // Generate TypeScript bindings
        await this.generateTypeScriptBindings(config, outputDir);
        // Generate JavaScript helpers
        await this.generateJavaScriptHelpers(config, outputDir);
        this.outputChannel.appendLine('✅ Bindings generated successfully');
    }
    async generateTypeScriptBindings(config, outputDir) {
        const bindingsContent = `// Generated TypeScript bindings for ${config.contractName}
import { Account, Contract } from 'near-api-js';

export interface ${capitalizeFirstLetter(config.contractName)}Contract {
    // View methods
    getOwner(): Promise<string>;
    getMetadata(): Promise<any>;
    getData(args: { key: string }): Promise<string | null>;
    hello(args: { name: string }): Promise<string>;

    // Call methods
    setData(args: { key: string; value: string }): Promise<void>;
    donate(): Promise<string>;
}

export class ${capitalizeFirstLetter(config.contractName)}Client {
    private contract: Contract & ${capitalizeFirstLetter(config.contractName)}Contract;

    constructor(account: Account, contractId: string) {
        this.contract = new Contract(account, contractId, {
            viewMethods: ['getOwner', 'getMetadata', 'getData', 'hello'],
            changeMethods: ['setData', 'donate']
        }) as Contract & ${capitalizeFirstLetter(config.contractName)}Contract;
    }

    // View methods
    async getOwner(): Promise<string> {
        return await this.contract.getOwner();
    }

    async getMetadata(): Promise<any> {
        return await this.contract.getMetadata();
    }

    async getData(key: string): Promise<string | null> {
        return await this.contract.getData({ key });
    }

    async hello(name: string): Promise<string> {
        return await this.contract.hello({ name });
    }

    // Call methods
    async setData(key: string, value: string, gas = '30000000000000'): Promise<void> {
        return await this.contract.setData({ key, value }, gas);
    }

    async donate(amount: string, gas = '30000000000000'): Promise<string> {
        return await this.contract.donate({}, gas, amount);
    }
}
`;
        const bindingsPath = path.join(outputDir, `${config.contractName}-bindings.ts`);
        fs.writeFileSync(bindingsPath, bindingsContent);
    }
    async generateJavaScriptHelpers(config, outputDir) {
        const helpersContent = `// Generated JavaScript helpers for ${config.contractName}
const { Contract } = require('near-api-js');

class ${capitalizeFirstLetter(config.contractName)}Client {
    constructor(account, contractId) {
        this.contract = new Contract(account, contractId, {
            viewMethods: ['getOwner', 'getMetadata', 'getData', 'hello'],
            changeMethods: ['setData', 'donate']
        });
    }

    // View methods
    async getOwner() {
        return await this.contract.getOwner();
    }

    async getMetadata() {
        return await this.contract.getMetadata();
    }

    async getData(key) {
        return await this.contract.getData({ key });
    }

    async hello(name) {
        return await this.contract.hello({ name });
    }

    // Call methods
    async setData(key, value, gas = '30000000000000') {
        return await this.contract.setData({ key, value }, gas);
    }

    async donate(amount, gas = '30000000000000') {
        return await this.contract.donate({}, gas, amount);
    }
}

module.exports = { ${capitalizeFirstLetter(config.contractName)}Client };
`;
        const helpersPath = path.join(outputDir, `${config.contractName}-helpers.js`);
        fs.writeFileSync(helpersPath, helpersContent);
    }
    dispose() {
        this.outputChannel.dispose();
    }
}
exports.NearBuildSystem = NearBuildSystem;
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).replace(/-/g, '');
}
//# sourceMappingURL=build-system.js.map