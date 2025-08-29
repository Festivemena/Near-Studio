import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class NearTaskProvider implements vscode.TaskProvider {
    provideTasks(): vscode.Task[] {
        const tasks: vscode.Task[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return tasks;

        const projectType = detectProjectTypeSync(workspaceFolder.uri.fsPath);
        if (!projectType) return tasks;

        // Build task
        let buildCommand = '';
        if (projectType === 'rust') {
            buildCommand = 'cargo build --target wasm32-unknown-unknown --release';
        } else if (projectType === 'javascript' || projectType === 'typescript') {
            buildCommand = 'npm run build';
        }

        const buildTask = new vscode.Task(
            { type: 'near', command: 'build' },
            vscode.TaskScope.Workspace,
            `Build ${projectType} Contract`,
            'near',
            new vscode.ShellExecution(buildCommand),
            []
        );
        tasks.push(buildTask);

        // Test task
        let testCommand = '';
        if (projectType === 'rust') {
            testCommand = 'cargo test';
        } else if (projectType === 'javascript' || projectType === 'typescript') {
            testCommand = 'npm test';
        }

        const testTask = new vscode.Task(
            { type: 'near', command: 'test' },
            vscode.TaskScope.Workspace,
            `Test ${projectType} Contract`,
            'near',
            new vscode.ShellExecution(testCommand),
            []
        );
        tasks.push(testTask);

        return tasks;
    }

    resolveTask(task: vscode.Task): vscode.Task | undefined {
        // Tasks do not need special resolution here
        return task;
    }
}

function detectProjectTypeSync(workspacePath: string): 'rust' | 'javascript' | 'typescript' | null {
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
        } catch {
            return null;
        }
    }

    return null;
}
