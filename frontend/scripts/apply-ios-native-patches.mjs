/**
 * Re-applies small iOS native fixes after install:
 * - SPM Package.swift for @capacitor-community/sqlite (upstream is CocoaPods-only).
 * - Capacitor CLI generates CapApp-SPM with swift-tools 5.9; SQLCipher.swift requires 6.0.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const sqliteDir = join(root, "node_modules/@capacitor-community/sqlite");
const sqlitePackageSrc = join(
  root,
  "scripts/ios-native-patches/capacitor-community-sqlite-Package.swift",
);
const sqlitePackageDest = join(sqliteDir, "Package.swift");

if (existsSync(sqliteDir) && existsSync(sqlitePackageSrc)) {
  const capIosPkg = join(root, "node_modules/@capacitor/ios/package.json");
  let capVersion = "8.2.0";
  if (existsSync(capIosPkg)) {
    try {
      capVersion = JSON.parse(readFileSync(capIosPkg, "utf8")).version;
    } catch {
      /* keep default */
    }
  }
  const body = readFileSync(sqlitePackageSrc, "utf8").replaceAll(
    "__CAPACITOR_IOS_VERSION__",
    capVersion,
  );
  writeFileSync(sqlitePackageDest, body, "utf8");
}

const sqlitePluginM = join(sqliteDir, "ios/Plugin/CapacitorSQLitePlugin.m");
const sqlitePluginMTemplate = join(root, "scripts/ios-native-patches/CapacitorSQLitePlugin.m");
// Replace upstream .m: CAP_PLUGIN() re-declares @interface CapacitorSQLitePlugin, which clashes with
// the Swift-generated interface when ObjC is a separate SPM target.
if (existsSync(sqlitePluginMTemplate) && existsSync(sqliteDir)) {
  copyFileSync(sqlitePluginMTemplate, sqlitePluginM);
}

const utilsUpgrade = join(sqliteDir, "ios/Plugin/Utils/UtilsUpgrade.swift");
if (existsSync(utilsUpgrade)) {
  let u = readFileSync(utilsUpgrade, "utf8");
  if (u.includes("for (statement) in statements")) {
    u = u.replaceAll("for (statement) in statements", "for statement in statements");
    writeFileSync(utilsUpgrade, u, "utf8");
  }
}

function bumpSpmToolsVersion(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  if (!text.includes("swift-tools-version: 5.9")) return;
  writeFileSync(
    filePath,
    text.replace(/swift-tools-version: 5\.9/g, "swift-tools-version: 6.0"),
    "utf8",
  );
}

bumpSpmToolsVersion(join(root, "node_modules/@capacitor/cli/dist/util/spm.js"));
bumpSpmToolsVersion(join(root, "node_modules/@capacitor/cli/dist/ios/update.js"));
