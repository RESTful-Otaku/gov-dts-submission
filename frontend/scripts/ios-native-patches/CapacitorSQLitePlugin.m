#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>
@import CapacitorCommunitySqliteSwift;

// SPM uses a separate ObjC target; Swift already declares @interface CapacitorSQLitePlugin : CAPPlugin
// in the generated Swift header. CAP_PLUGIN() also emits @interface CapacitorSQLitePlugin : NSObject,
// which causes "duplicate interface definition". This file only adds the CAPBridgedPlugin category.

@interface CapacitorSQLitePlugin (CAPPluginCategory) <CAPBridgedPlugin>
@end

@implementation CapacitorSQLitePlugin (CAPPluginCategory)

- (NSArray *)pluginMethods {
    NSMutableArray *methods = [NSMutableArray new];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"echo" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"createConnection" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"closeConnection" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"createNCConnection" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"closeNCConnection" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"getNCDatabasePath" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"open" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"close" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"getUrl" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"getVersion" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"execute" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"executeSet" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"run" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"query" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"isDBExists" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"isDBOpen" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"deleteDatabase" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"importFromJson" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"isJsonValid" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"exportToJson" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"deleteExportedRows" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"createSyncTable" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"setSyncDate" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"getSyncDate" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"addUpgradeStatement" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"copyFromAssets" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"isDatabase" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"isNCDatabase" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"isTableExists" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"getDatabaseList" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"getTableList" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"getMigratableDbList" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"addSQLiteSuffix" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"deleteOldDatabases" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"moveDatabasesAndAddSuffix" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"checkConnectionsConsistency" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"isSecretStored" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"setEncryptionSecret" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"changeEncryptionSecret" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"clearEncryptionSecret" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"getFromHTTPRequest" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"checkEncryptionSecret" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"isInConfigEncryption" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"isInConfigBiometricAuth" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"isDatabaseEncrypted" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"beginTransaction" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"commitTransaction" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"rollbackTransaction" returnType:CAPPluginReturnPromise]];
    [methods addObject:[[CAPPluginMethod alloc] initWithName:@"isTransactionActive" returnType:CAPPluginReturnPromise]];
    return methods;
}

- (NSString *)identifier {
    return @"CapacitorSQLitePlugin";
}

- (NSString *)jsName {
    return @"CapacitorSQLite";
}

@end
