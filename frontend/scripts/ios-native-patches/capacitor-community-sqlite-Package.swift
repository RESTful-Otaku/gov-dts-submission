// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "CapacitorCommunitySqlite",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapacitorCommunitySqlite",
            targets: ["CapacitorCommunitySqlite"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "__CAPACITOR_IOS_VERSION__"),
        .package(url: "https://github.com/sqlcipher/SQLCipher.swift.git", exact: "4.14.0"),
        .package(url: "https://github.com/weichsel/ZIPFoundation.git", from: "0.9.19")
    ],
    targets: [
        .target(
            name: "CapacitorCommunitySqlite",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "SQLCipher", package: "SQLCipher.swift"),
                .product(name: "ZIPFoundation", package: "ZIPFoundation")
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist"],
            linkerSettings: [
                .linkedFramework("LocalAuthentication")
            ]
        )
    ]
)
