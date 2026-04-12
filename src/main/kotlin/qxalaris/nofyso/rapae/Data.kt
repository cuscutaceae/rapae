package qxalaris.nofyso.rapae

class UpdateResultWrapper(
    val success: Boolean,
    val value: UpdateResultSuccessValueWrapper? = null,
    val errorCode: Int? = null
)

class UpdateResultSuccessValueWrapper(
    val orderedResults: List<UpdateCheckResult>
)

class UpdateCheckResult(
    val appVersion: String,
    val contentBundleVersion: String,
    val jsonUrl: String,
    val jsonSize: Int,
    val bundleParts: List<BundlePart>
) {
    override fun toString(): String {
        return "UpdateCheckResult(appVersion='$appVersion', contentBundleVersion='$contentBundleVersion', jsonUrl='$jsonUrl', jsonSize=$jsonSize, bundleParts=$bundleParts)"
    }
}

class BundlePart(
    val bundleSize: Int,
    val bundleUrl: String
) {
    override fun toString(): String {
        return "BundlePart(bundleSize=$bundleSize, bundleUrl='$bundleUrl')"
    }
}

class BundleInfo(
    val versionNumber: String,
    val previousVersionNumber: String,
    val applicationVersionNumber: String,
    val uuid: String,
    val totalPartitions: Int,
    val added: List<BundleAddition>
)

class BundleAddition(
    val path: String,
    val byteOffset: Long,
    val length: Long,
    val partIndex: Int,
    val sha256HashBase64Encoded: String
)