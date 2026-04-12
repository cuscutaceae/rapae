package qxalaris.nofyso.rapae

import com.google.gson.Gson
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.io.IOException
import java.nio.file.*
import java.nio.file.attribute.BasicFileAttributes
import kotlin.io.path.*

val log: Logger = LoggerFactory.getLogger("qxalaris.nofyso.rapae")
val client = OkHttpClient.Builder().build()

fun main(args: Array<String>) {
    try {
        x(args[0])
    } catch (x: Exception) {
        log.error(x.localizedMessage)
    }
}

fun x(basePathString: String) {
    val outputPath = Paths.get(basePathString)
    log.info("rapae starting, working path: $outputPath")
    if (Files.notExists(outputPath)) {
        Files.createDirectories(outputPath)
        log.info("created working directory")
    }
    log.info("fetching version code from iTune")
    val response = client.newCall(
        Request.Builder().get().url("https://apps.apple.com/us/app/arcaea/id1205999125".toHttpUrl()).build()
    )
        .execute().body?.string() ?: throw IOException("empty body")
    val appVersion =
        "(?<=\"primarySubtitle\":\"Version ).*?(?=\")".toRegex().find(response)?.value
            ?: throw IOException("nothing matched: $response")
    log.info("calling api for update checking")
    val resultRaw =
        client.newCall(checkUpdateRequest(appVersion)).execute().body?.string() ?: throw IOException("empty body")
    log.info("app version for iTunes: $appVersion")
    val updateResultWrapper =
        Gson().fromJson(resultRaw, UpdateResultWrapper::class.java)
    val updateResultValue =
        updateResultWrapper.value
            ?: throw IOException("bad response or returned error code: ${updateResultWrapper.errorCode}: ${updateResultWrapper.success}")
    if (updateResultValue.orderedResults.isEmpty()) {
        log.error("no bundle found, that's strange...")
        return
    }
    val bundleInfo = updateResultValue.orderedResults.first()
    log.info("update info app version: ${bundleInfo.appVersion}")
    log.info("update info content bundle version: ${bundleInfo.contentBundleVersion}")
    log.info("loading previous bundle json")
    val bundleInfoPath = outputPath.resolve("bundle.json")
    val previousVersion = if (Files.exists(bundleInfoPath)) {
        val previousUpdateInfo = Gson().fromJson(bundleInfoPath.readText(), BundleInfo::class.java)
        previousUpdateInfo.versionNumber
    } else {
        "0.0.0"
    }
    log.info("downloading bundle json... (${bundleInfo.jsonSize})")
    download(client, bundleInfo.jsonUrl, bundleInfoPath.toAbsolutePath().toString())
    val bundleUpdateInfo = Gson().fromJson(bundleInfoPath.readText(), BundleInfo::class.java)
    log.info("bundle app version: ${bundleUpdateInfo.applicationVersionNumber}")
    log.info("bundle version: ${bundleUpdateInfo.versionNumber}")
    log.info("bundle previous version: ${bundleUpdateInfo.previousVersionNumber}")
    log.info("bundle uuid: ${bundleUpdateInfo.uuid}")
    log.info("bundle partitions: ${bundleUpdateInfo.totalPartitions}")
    log.info("old bundle version: $previousVersion")
    if (!isNeedUpdate(previousVersion, bundleUpdateInfo.versionNumber)) {
        log.info("${bundleUpdateInfo.versionNumber}<=${previousVersion}, skip update")
        return
    }
    log.info("deleting previous version...")
    Files.walkFileTree(outputPath, object : SimpleFileVisitor<Path>() {
        override fun visitFile(file: Path?, attrs: BasicFileAttributes?): FileVisitResult {
            if (file != null && file.name != "bundle.json" && !file.isHidden() && !file.name.startsWith(".")) {
                Files.deleteIfExists(file)
            }
            return FileVisitResult.CONTINUE
        }

        override fun postVisitDirectory(dir: Path?, exc: IOException?): FileVisitResult {
            if (dir != null && dir != outputPath) {
                Files.deleteIfExists(dir)
            }
            return FileVisitResult.CONTINUE
        }
    })
    bundleInfo.bundleParts.forEachIndexed { i, it ->
        log.info("downloading bundle partition: $i (${it.bundleSize}B)...")
        download(client, it.bundleUrl, outputPath.resolve("bundle_p${i}.raw").toAbsolutePath().toString())
    }
    log.info("extracting resources...")
    val cache = HashMap<Int, ByteArray>()
    bundleUpdateInfo.added.forEach {
        val path = outputPath.resolve(it.path)
        if (Files.notExists(path.parent)) {
            Files.createDirectories(path.parent)
        }
        log.info("extracting ${it.path} ${it.partIndex}:${it.byteOffset}~${it.length}")
        val partFile = outputPath.resolve("bundle_p${it.partIndex}.raw")
        if (!partFile.exists()) {
            log.warn("partition ${it.partIndex} not exist!")
            return@forEach
        }
        if (!cache.containsKey(it.partIndex)) {
            cache[it.partIndex] = partFile.readBytes()
        }
        val rawBuffer = cache[it.partIndex]!!
        val buffer = ByteArray(it.length.toInt())
        rawBuffer.copyInto(buffer, 0, it.byteOffset.toInt(), it.byteOffset.toInt() + it.length.toInt())
        Files.deleteIfExists(path)
        Files.createFile(path)
        path.outputStream().use { outputStream ->
            outputStream.write(buffer)
        }
        val checkValid = digestAndCompare(path.readBytes(), it.sha256HashBase64Encoded)
        if (!checkValid) {
            log.warn("SHA256 check failed!")
        }
    }
}

fun checkUpdateRequest(appVersion: String) =
    Request.Builder().get()
        .url("https://arcapi-v3.lowiro.com/steeptennis/40/game/content_bundle".toHttpUrl())
        .header("X-Random-Challenge", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
        .header("Platform", "android")
        .header("AppVersion", appVersion)
        .header("ContentBundle", "0.0.0")
        .header("DeviceId", "0000000000000000")
        .build()