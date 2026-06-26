import AdmZip from "adm-zip";
import path from "path";
import * as fs from "fs";

async function readFileStream(
    filePath: string,
    start: number,
    length: number,
): Promise<Buffer> {
    let buffer = Buffer.alloc(length);
    let bytesRead = 0;
    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(filePath, {
            start: start,
            end: start + length - 1,
            highWaterMark: 64 * 1024,
        });
        readStream.on("data", (chunk: Buffer) => {
            if (bytesRead >= length) {
                readStream.destroy(new Error("Read more bytes than expected"));
                reject(new Error("Read more bytes than expected"));
            }
            chunk.copy(buffer, bytesRead, 0, chunk.length);
            bytesRead += chunk.length;
        });
        readStream.on("end", () => {
            resolve(buffer);
        });
        readStream.on("error", reject);
    });
}

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

export { readFileStream, extractDirectory };
