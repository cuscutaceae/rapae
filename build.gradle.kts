plugins {
    kotlin("jvm") version "2.0.0"
    application
}

group = "han.cirno"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
    maven { setUrl("https://jitpack.io") }
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.slf4j:slf4j-simple:2.0.9")
    implementation("com.google.code.gson:gson:2.13.2")
}

tasks.test {
    useJUnitPlatform()
}

application {
    mainClass = "qxalaris.nofyso.rapae.MainKt"
}

kotlin {
    jvmToolchain(17)
}