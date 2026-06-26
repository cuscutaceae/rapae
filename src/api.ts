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

const BundleJsonSchema = z.object({
    versionNumber: z.string(),
    applicationVersionNumber: z.string(),
    uuid: z.string(),
    totalPartitions: z.number(),
    added: z.array(
        z.object({
            path: z.string(),
            length: z.number(),
            byteOffset: z.number(),
            partIndex: z.number(),
            sha256HashBase64Encoded: z.string(),
        }),
    ),
    pathToHash: z.record(z.string(), z.string()),
});

const BundleResponseSchema = z.object({
    success: z.boolean(),
    value: z.object({
        orderedResults: z.array(
            z.object({
                appVersion: z.string(),
                contentBundleVersion: z.string(),
                jsonUrl: z.url(),
                jsonSize: z.number(),
                bundleParts: z.array(
                    z.object({
                        bundleSize: z.number(),
                        bundleUrl: z.url(),
                    }),
                ),
            }),
        ),
    }),
});

type VersionResponse = z.infer<typeof VersionResponseSchema>;
type BundleInfo = z.infer<typeof BundleJsonSchema>;
type BundleResponse = z.infer<typeof BundleResponseSchema>;

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

async function fetchBundleResponse(
    targetUrl: string,
    appVersion: string,
): Promise<BundleResponse> {
    const result = await fetch(targetUrl, {
        method: "GET",
        headers: {
            "X-Random-Challenge":
                "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
            Platform: "android",
            AppVersion: appVersion,
            ContentBundle: "0.0.0",
            DeviceId: "0000000000000000",
        },
    });
    if (!result.ok) {
        throw new Error(`HTTP error! status: ${result.status}`);
    }
    const parsed = BundleResponseSchema.safeParse(await result.json());
    if (!parsed.success) {
        throw new Error(
            `Failed to parse bundle response: ${parsed.error.message}`,
        );
    }
    return parsed.data;
}

async function readLocalBundleInfo(
    workingDir: string,
): Promise<BundleInfo | null> {
    const bundleJsonPath = `${workingDir}/bundle.json`;
    if (!fs.existsSync(bundleJsonPath)) {
        return null;
    }
    const result = fs.readFileSync(bundleJsonPath, "utf-8");
    const parsed = BundleJsonSchema.safeParse(JSON.parse(result));
    if (!parsed.success) {
        throw new Error(
            `Failed to parse existing version info: ${parsed.error.message}`,
        );
    }
    return parsed.data;
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

export { fetchVersion, fetchBundleResponse, readLocalBundleInfo, downloadFile };
export type { VersionResponse, BundleInfo as BundleVersionInfo };
