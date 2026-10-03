#!/usr/bin/env node

import * as fs from "fs";
import { Logger } from "tslog";
import { downloadFile, fetchVersion, readLocalAppVersionInfo } from "./api.js";
import { compareVersions, toSafeUrl } from "./util.js";
import * as cliProgress from "cli-progress";
import { extractDirectory } from "./files.js";
import { analyzeTable } from "./table.js";

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
const TABLE_URL =
    process.env.RAPAE_TABLE_URL ??
    (() => {
        throw new Error("RAPAE_TABLE_URL environment variable is not set");
    })();

type Result = {
    status: number;
    shouldCommitBundle: boolean;
    shouldCommitDifficulties: boolean;
};

async function main(): Promise<Result> {
    let shouldCommitDifficulties = false;
    log.info("[*] rapae starting");
    log.info(`[*] Working directory: ${workingDir}`);
    if (!fs.existsSync(workingDir)) {
        fs.mkdirSync(workingDir, { recursive: true });
        log.info(`[+] Created working directory: ${workingDir}`);
    }
    log.info("[*] Fetching difficulties");
    try {
        let rows = await analyzeTable(TABLE_URL);
        let data = {
            difficulties: rows,
        };
        fs.writeFileSync(
            `${workingDir}/difficulties.json`,
            JSON.stringify(data),
        );
        shouldCommitDifficulties = true;
    } catch (e) {
        log.warn(`[-] Failed to fetch difficulties: ${e}`);
    }
    const remoteVersionInfo = await fetchVersion(VERSION_CHECK_URL);
    const targetVersion = remoteVersionInfo.value.version;
    log.info("[+] Fetched version info:");
    log.info(`      Version: ${targetVersion}`);
    log.info(`      URL: ${toSafeUrl(remoteVersionInfo.value.url)}`);
    const localVersionInfo = await readLocalAppVersionInfo(workingDir);
    const needUpdateBundle = (() => {
        if (!localVersionInfo) {
            log.info("[*] No local version info found, need to update");
            return true;
        }
        log.info("[*] Local version info:");
        log.info(`      Version: ${localVersionInfo.value.version}`);
        log.info(`      Url: ${localVersionInfo.value.url}`);
        const versionCompareResult = compareVersions(
            localVersionInfo.value.version,
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
    if (!needUpdateBundle) {
        log.info("[*] No update needed, exiting");
        return {
            shouldCommitBundle: false,
            status: 0,
            shouldCommitDifficulties,
        };
    }
    log.info("[*] Downloading apk");
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
            VERSION_CHECK_URL,
            `${workingDir}/app.json`,
            bar.create(100, 0, { task: "app.json" }),
        ),
    ];
    await Promise.all(promises);
    bar.stop();
    log.info("[+] Download complete");
    log.info("[*] Extracting APK assets: dynamic libraries");
    extractDirectory(`${workingDir}/apk.tmp`, "assets", workingDir);
    extractDirectory(
        `${workingDir}/apk.tmp`,
        "lib/arm64-v8a",
        `${workingDir}/lib.tmp`,
    );
    log.info("[*] Extracting APK assets: assets");
    extractDirectory(`${workingDir}/apk.tmp`, "assets", `${workingDir}/`);
    log.info("[+] Extracted APK assets");
    fs.writeFileSync(`${workingDir}/.gitignore`, "*.tmp\n");
    log.info("[+] Git ignore file created");
    return { shouldCommitBundle: true, status: 0, shouldCommitDifficulties };
}

const result = await main();
fs.writeFileSync(`${workingDir}/result.tmp`, JSON.stringify(result));
process.exit(result.status);
