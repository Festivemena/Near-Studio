import * as fs from 'fs';

export function fileExists(path: string): boolean {
    try {
        return fs.existsSync(path);
    } catch {
        return false;
    }
}
