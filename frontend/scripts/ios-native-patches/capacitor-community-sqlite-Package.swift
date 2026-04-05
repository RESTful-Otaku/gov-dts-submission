// swift-tools-version: 6.0
import PackageDescription

// SPM disallows Swift + Objective-C in a single target. Split the plugin Swift sources
// from CapacitorSQLitePlugin.m (CAP_PLUGIN category on the Swift class).
let package = Package(
    name: "CapacitorCommunitySqlite",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapacitorCommunitySqlite",
            targets: [
                "CapacitorCommunitySqliteSwift",
                "CapacitorCommunitySqliteObjC",
            ])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "__CAPACITOR_IOS_VERSION__"),
        .package(url: "https://github.com/sqlcipher/SQLCipher.swift.git", exact: "4.14.0"),
        .package(url: "https://github.com/weichsel/ZIPFoundation.git", from: "0.9.19")
    ],
    targets: [
        .target(
            name: "CapacitorCommunitySqliteSwift",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "SQLCipher", package: "SQLCipher.swift"),
                .product(name: "ZIPFoundation", package: "ZIPFoundation")
            ],
            path: "ios/Plugin",
            exclude: [
                "Info.plist",
                "CapacitorSQLitePlugin.m",
                "CapacitorSQLitePlugin.h",
            ],
            linkerSettings: [
                .linkedFramework("LocalAuthentication")
            ]
        ),
        .target(
            name: "CapacitorCommunitySqliteObjC",
            dependencies: [
                .target(name: "CapacitorCommunitySqliteSwift"),
                .product(name: "Capacitor", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            sources: ["CapacitorSQLitePlugin.m"]
        )
    ]
)
