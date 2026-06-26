#!/usr/bin/env node

import * as fs from "fs";
import { Logger } from "tslog";
import {
    downloadFile,
    fetchBundleResponse,
    fetchVersion,
    readLocalBundleInfo,
} from "./api.js";
import { compareVersions, getPureVersion, toSafeUrl } from "./util.js";
import * as cliProgress from "cli-progress";
import { extractDirectory, readFileStream } from "./files.js";
import path from "path";
import crypto from "crypto";

const log = new Logger({
    name: "rapae",
    hideLogPositionForProduction: true,
    prettyLogTemplate:
        "{{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{MM}}:{{ss}}\t{{name}}\t",
});
const workingDir = process.argv[2] || process.cwd();

const VERSION_CHECK_URL =
    process.env.RAPAE_VERSION_URL ??
    (() => {
        throw new Error("RAPAE_VERSION_URL environment variable is not set");
    })();
const TARGET_URL =
    process.env.RAPAE_TARGET_URL ??
    (() => {
        throw new Error("RAPAE_TARGET_URL environment variable is not set");
    })();

type Result = {
    status: number;
    shouldCommit: boolean;
};

async function main(): Promise<Result> {
    log.info("[*] rapae starting");
    log.info(`[*] Working directory: ${workingDir}`);
    if (!fs.existsSync(workingDir)) {
        fs.mkdirSync(workingDir, { recursive: true });
        log.info(`[+] Created working directory: ${workingDir}`);
    }
    const remoteVersionInfo = await fetchVersion(VERSION_CHECK_URL);
    const targetVersion = getPureVersion(remoteVersionInfo.value.version);
    log.info("[+] Fetched version info:");
    log.info(`      Version: ${remoteVersionInfo.value.version}`);
    log.info(`      Version (Filtered): ${targetVersion}`);
    log.info(`      URL: ${toSafeUrl(remoteVersionInfo.value.url)}`);
    const localBundleInfo = await readLocalBundleInfo(workingDir);
    const needUpdate = (() => {
        if (!localBundleInfo) {
            log.info("[*] No local bundle info found, need to update");
            return true;
        }
        log.info("[*] Local bundle info:");
        log.info(`      Version: ${localBundleInfo.versionNumber}`);
        log.info(
            `      Application Version: ${localBundleInfo.applicationVersionNumber}`,
        );
        log.info(`      UUID: ${localBundleInfo.uuid}`);
        log.info(`      Partitions: ${localBundleInfo.totalPartitions}`);
        const versionCompareResult = compareVersions(
            localBundleInfo.versionNumber,
            targetVersion,
        );
        if (versionCompareResult > 0) {
            log.info(
                "[*] Local version is newer than target version, no update needed",
            );
        }
        if (versionCompareResult === 0) {
            log.info(
                "[*] Local version is the same as target version, no update needed",
            );
        }
        return versionCompareResult < 0;
    })();
    if (!needUpdate) {
        log.info("[*] No update needed, exiting");
        return { shouldCommit: false, status: 0 };
    }
    log.info("[*] Fetching bundle info");
    const bundleInfo = await fetchBundleResponse(
        TARGET_URL,
        targetVersion,
    ).then((bundleResponse) => {
        return bundleResponse.value.orderedResults[0] ?? null;
    });
    if (!bundleInfo) {
        log.error("[-] Failed to fetch bundle info, exiting");
        return { shouldCommit: false, status: 1 };
    }
    log.info("[+] Fetched bundle info:");
    log.info(`      Application Version: ${bundleInfo.appVersion}`);
    log.info(
        `      Content Bundle Version: ${bundleInfo.contentBundleVersion}`,
    );
    log.info(`      Json Size: ${bundleInfo.jsonSize}`);
    log.info(`      Bundle Partitions: ${bundleInfo.bundleParts.length}`);
    for (const index in bundleInfo.bundleParts) {
        const it = bundleInfo.bundleParts[index] ?? null;
        if (!it) {
            log.error(
                `[-] Failed to fetch bundle part info for index ${index}, exiting`,
            );
            return { shouldCommit: false, status: 1 };
        }
        log.info(`      Part ${index}: ${it.bundleSize} B`);
    }
    log.info("[*] Downloading apk and bundle files");
    const bar = new cliProgress.MultiBar({
        clearOnComplete: false,
        hideCursor: true,
        format: " {bar} | {task} | {value}/{total}",
    });
    let promises: Promise<void>[] = [
        downloadFile(
            remoteVersionInfo.value.url,
            `${workingDir}/apk.tmp`,
            bar.create(100, 0, { task: "apk.tmp" }),
        ),
        downloadFile(
            bundleInfo.jsonUrl,
            `${workingDir}/bundle.json`,
            bar.create(100, 0, { task: "bundle.json" }),
        ),
    ];
    for (const it in bundleInfo.bundleParts) {
        const part = bundleInfo.bundleParts[it] ?? null;
        if (!part) {
            log.error(
                `[-] Failed to fetch bundle part info for index ${it}, exiting`,
            );
            return { shouldCommit: false, status: 1 };
        }
        await downloadFile(
            part.bundleUrl,
            `${workingDir}/bundle_part_${it}.tmp`,
            bar.create(100, 0, { task: `bundle_part_${it}.tmp` }),
        );
    }
    await Promise.all(promises);
    bar.stop();
    log.info("[+] Download complete");
    log.info("[*] Extracting APK assets");
    extractDirectory(`${workingDir}/apk.tmp`, "assets", workingDir);
    extractDirectory(
        `${workingDir}/apk.tmp`,
        "lib/arm64-v8a",
        `${workingDir}/lib.tmp`,
    );
    log.info("[+] Extracted APK assets");
    const newBundleInfo = await readLocalBundleInfo(workingDir);
    if (!newBundleInfo) {
        log.error("[-] Failed to read new bundle info, exiting");
        return { shouldCommit: false, status: 1 };
    }
    log.info(`      Version: ${newBundleInfo.versionNumber}`);
    log.info(
        `      Application Version: ${newBundleInfo.applicationVersionNumber}`,
    );
    log.info(`      UUID: ${newBundleInfo.uuid}`);
    log.info(`      Partitions: ${newBundleInfo.totalPartitions}`);
    for (const index in newBundleInfo.added) {
        const it = newBundleInfo.added[index] ?? null;
        if (!it) {
            log.error(
                `[-] Failed to fetch new bundle part info for index ${index}, exiting`,
            );
            return { shouldCommit: false, status: 1 };
        }
        const partFile = `${workingDir}/bundle_part_${it.partIndex}.tmp`;
        if (!fs.existsSync(partFile)) {
            log.error(
                `[-] Bundle part file ${partFile} does not exist, exiting`,
            );
            return { shouldCommit: false, status: 1 };
        }
        const buffer = await readFileStream(partFile, it.byteOffset, it.length);
        const sha256Hash = crypto
            .createHash("sha256")
            .update(buffer)
            .digest("base64");
        if (sha256Hash !== it.sha256HashBase64Encoded) {
            log.error(
                `[-] SHA256 hash mismatch for ${partFile} (expected: ${it.sha256HashBase64Encoded}, got: ${sha256Hash}), exiting`,
            );
            return { shouldCommit: false, status: 1 };
        }
        fs.mkdirSync(path.dirname(`${workingDir}/${it.path}`), {
            recursive: true,
        });
        fs.writeFileSync(`${workingDir}/${it.path}`, buffer);
        process.stdout.write(".");
    }
    console.log("");
    log.info(
        `[+] Bundle extraction complete: ${newBundleInfo.added.length} files`,
    );
    fs.writeFileSync(`${workingDir}/.gitignore`, "*.tmp\n");
    log.info("[+] Git ignore file created");
    return { shouldCommit: true, status: 0 };
}

const result = await main();
fs.writeFileSync(`${workingDir}/result.tmp`, JSON.stringify(result));
process.exit(result.status);
