import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { crc32 } from "node:zlib";
import { openPromise } from "yauzl";
import type { Entry, ZipFile } from "yauzl";

async function extractFile(zip: ZipFile, entry: Entry, targetPath: string) {
    const parentDir = path.dirname(targetPath);
    await mkdir(parentDir, { recursive: true });
    const tempDir = await mkdtemp(path.join(parentDir, ".extract-"));
    const tempPath = path.join(tempDir, "entry");

    try {
        let checksum = 0;
        const verifyChecksum = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
                checksum = crc32(chunk, checksum);
                callback(null, chunk);
            },
        });
        const source = await zip.openReadStreamPromise(entry);
        await pipeline(source, verifyChecksum, createWriteStream(tempPath));
        if (checksum !== entry.crc32) {
            throw new Error(`CRC32 mismatch: ${entry.fileName}`);
        }
        await rename(tempPath, targetPath);
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}

async function extractDirectory(
    zipPath: string,
    sourceDir: string,
    targetDir: string,
): Promise<void> {
    const zip = await openPromise(zipPath, { autoClose: false });
    const prefix = `${sourceDir}/`;
    let found = false;

    try {
        await mkdir(targetDir, { recursive: true });
        for await (const entry of zip.eachEntry()) {
            const { fileName } = entry;
            if (!fileName.startsWith(prefix) && fileName !== sourceDir) {
                continue;
            }
            found = true;
            const relativePath = fileName.startsWith(prefix)
                ? fileName.slice(prefix.length)
                : fileName;
            if (!relativePath) {
                continue;
            }
            const targetPath = path.join(targetDir, relativePath);
            if (fileName.endsWith("/")) {
                await mkdir(targetPath, { recursive: true });
            } else {
                await extractFile(zip, entry, targetPath);
            }
        }
    } finally {
        zip.close();
    }

    if (!found) {
        console.warn(`directory not found: ${sourceDir}`);
    }
}

export { extractDirectory };
