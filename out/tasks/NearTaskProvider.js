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
exports.NearTaskProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class NearTaskProvider {
    provideTasks() {
        const tasks = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return tasks;
        const projectType = detectProjectTypeSync(workspaceFolder.uri.fsPath);
        if (!projectType)
            return tasks;
        // Build task
        let buildCommand = '';
        if (projectType === 'rust') {
            buildCommand = 'cargo build --target wasm32-unknown-unknown --release';
        }
        else if (projectType === 'javascript' || projectType === 'typescript') {
            buildCommand = 'npm run build';
        }
        const buildTask = new vscode.Task({ type: 'near', command: 'build' }, vscode.TaskScope.Workspace, `Build ${projectType} Contract`, 'near', new vscode.ShellExecution(buildCommand), []);
        tasks.push(buildTask);
        // Test task
        let testCommand = '';
        if (projectType === 'rust') {
            testCommand = 'cargo test';
        }
        else if (projectType === 'javascript' || projectType === 'typescript') {
            testCommand = 'npm test';
        }
        const testTask = new vscode.Task({ type: 'near', command: 'test' }, vscode.TaskScope.Workspace, `Test ${projectType} Contract`, 'near', new vscode.ShellExecution(testCommand), []);
        tasks.push(testTask);
        return tasks;
    }
    resolveTask(task) {
        // Tasks do not need special resolution here
        return task;
    }
}
exports.NearTaskProvider = NearTaskProvider;
function detectProjectTypeSync(workspacePath) {
    const cargoToml = path.join(workspacePath, 'Cargo.toml');
    const packageJson = path.join(workspacePath, 'package.json');
    if (fs.existsSync(cargoToml)) {
        return 'rust';
    }
    if (fs.existsSync(packageJson)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
            if (pkg.dependencies && pkg.dependencies['near-sdk-js']) {
                if (pkg.devDependencies && pkg.devDependencies['typescript']) {
                    return 'typescript';
                }
                return 'javascript';
            }
        }
        catch {
            return null;
        }
    }
    return null;
}
//# sourceMappingURL=NearTaskProvider.js.map