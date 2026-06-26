function getPureVersion(version: string): string {
    return version
        .split("")
        .filter((char) => (char >= "0" && char <= "9") || char === ".")
        .join("");
}

function compareVersions(versionA: string, versionB: string): number {
    const partsA = versionA.split(".").map(Number);
    const partsB = versionB.split(".").map(Number);
    const maxLength = Math.max(partsA.length, partsB.length);
    for (let i = 0; i < maxLength; i++) {
        const numA = i < partsA.length ? (partsA[i] ?? 0) : 0;
        const numB = i < partsB.length ? (partsB[i] ?? 0) : 0;
        if (numA > numB) return 1;
        if (numA < numB) return -1;
    }
    return 0;
}

function toSafeUrl(url: string): string {
    const urlObj = new URL(url);
    return urlObj.pathname;
}

export { getPureVersion, compareVersions, toSafeUrl };
