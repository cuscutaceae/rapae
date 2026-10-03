import { z } from "zod";
import * as fs from "fs";
import got from "got";
import * as cliProgress from "cli-progress";

const VersionResponseSchema = z.object({
    success: z.boolean(),
    value: z.object({
        url: z.url(),
        version: z.string(),
    }),
});

type VersionResponse = z.infer<typeof VersionResponseSchema>;

async function fetchVersion(versionCheckUrl: string): Promise<VersionResponse> {
    const result = await fetch(versionCheckUrl, {
        method: "GET",
    });
    if (!result.ok) {
        throw new Error(`HTTP error! status: ${result.status}`);
    }
    const parsed = VersionResponseSchema.safeParse(await result.json());
    if (!parsed.success) {
        throw new Error(
            `Failed to parse version response: ${parsed.error.message}`,
        );
    }
    return parsed.data;
}

async function readLocalAppVersionInfo(
    workingDir: string,
): Promise<VersionResponse | null> {
    const bundleJsonPath = `${workingDir}/app.json`;
    if (!fs.existsSync(bundleJsonPath)) {
        return null;
    }
    const result = fs.readFileSync(bundleJsonPath, "utf-8");
    const parsed = VersionResponseSchema.safeParse(JSON.parse(result));
    if (!parsed.success) {
        throw new Error(
            `Failed to parse existing version info: ${parsed.error.message}`,
        );
    }
    return parsed.data;
}

async function fetchDifficultyTable(url: string): Promise<string> {
    const result = await fetch(url);
    if (!result.ok) {
        throw new Error(`HTTP error! status: ${result.status}`);
    }
    return result.text();
}

function downloadFile(
    url: string,
    destinationPath: string,
    progressBar: cliProgress.SingleBar,
    headers: Record<string, string> = {},
): Promise<void> {
    const fileStream = fs.createWriteStream(destinationPath);
    const request = got.stream(url, { headers });
    request.pipe(fileStream);
    request.on("downloadProgress", (progress) => {
        progressBar.update(Number((progress.percent * 100.0).toFixed(2)));
    });
    return new Promise((resolve, reject) => {
        fileStream.on("finish", () => {
            progressBar.stop();
            resolve();
        });
        fileStream.on("error", (err) => {
            progressBar.stop();
            reject(err);
        });
    });
}

export {
    fetchVersion,
    fetchDifficultyTable,
    readLocalAppVersionInfo,
    downloadFile,
};
export type { VersionResponse };
