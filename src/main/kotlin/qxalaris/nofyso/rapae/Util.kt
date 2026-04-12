package qxalaris.nofyso.rapae

import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.util.*

fun download(client: OkHttpClient, url: String, outputPath: String) {
    val request = Request.Builder()
        .url(url)
        .build()
    client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) throw IOException("Unexpected code $response")
        val inputStream = response.body?.byteStream()
        val file = File(outputPath)
        inputStream?.use { input ->
            file.outputStream().use { output ->
                input.copyTo(output)
            }
        }
    }
}

fun getSha256Digest(src: ByteArray): ByteArray =
    MessageDigest.getInstance("SHA-256").digest(src)

fun digestAndCompare(src1: ByteArray, src2Base64: String): Boolean {
    val oriDigest = getSha256Digest(src1)
    val expectedDigest = Base64.getDecoder().decode(src2Base64)
    return Objects.deepEquals(oriDigest, expectedDigest)
}

fun isNeedUpdate(ori: String, new: String): Boolean {
    val oriVersion = ori.split(".").let {
        Triple(
            it[0].toInt(),
            it[1].toInt(),
            it[2].toInt()
        )
    }
    val newVersion = new.split(".").let {
        Triple(
            it[0].toInt(),
            it[1].toInt(),
            it[2].toInt()
        )
    }
    if (oriVersion.first < newVersion.first) return true
    if (oriVersion.first > newVersion.first) return false
    if (oriVersion.second < newVersion.second) return true
    if (oriVersion.second > newVersion.second) return false
    if (oriVersion.third < newVersion.third) return true
    if (oriVersion.third > newVersion.third) return false
    return false
}