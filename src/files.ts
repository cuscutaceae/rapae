import AdmZip from "adm-zip";
import path from "path";
import * as fs from "fs";

function extractDirectory(
    zipPath: string,
    sourceDir: string,
    targetDir: string,
): void {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetEntries = entries.filter(
        (entry) =>
            entry.entryName.startsWith(sourceDir + "/") ||
            entry.entryName === sourceDir,
    );
    if (targetEntries.length === 0) {
        console.warn(`directory not found: ${sourceDir}`);
        return;
    }
    targetEntries.forEach((entry) => {
        const relativePath = entry.entryName.replace(sourceDir + "/", "");
        if (!relativePath) return;
        const targetPath = path.join(targetDir, relativePath);
        if (entry.isDirectory) {
            if (!fs.existsSync(targetPath)) {
                fs.mkdirSync(targetPath, { recursive: true });
            }
        } else {
            const content = entry.getData();
            const dir = path.dirname(targetPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(targetPath, content);
        }
    });
}

export { extractDirectory };
