# Debugging the Production Build

When `npm run electron:dev` works but `npm run electron:build` fails, it usually points to an issue in the packaging phase (electron-builder), native module compilation for production, or environment-specific constraints (like permissions or disk space).

## Common Causes & Fixes

### 1. Electron-Builder Cache Corruption
The error `ERROR: Cannot create directory ...\Cache\winCodeSign` suggests the cache for signing tools is corrupted or blocked.
**Fix**: Clear the cache folder manually and try again.
```powershell
Remove-Item -Recurse -Force $env:LOCALAPPDATA\electron-builder\Cache
```

### 2. Native Module Incompatibility
Native modules (like `better-sqlite3`) must be compiled for the specific version of Electron you are using. While `electron-rebuild` handles this for dev, `electron-builder` does its own pass.
**Fix**: Ensure `better-sqlite3` is in your root `dependencies` (not devDependencies) so it gets bundled correctly.

### 3. File Path Lengths (Windows)
Windows has a 260-character path limit. Deeps nested folders in `node_modules` can sometimes exceed this during the build process.
**Fix**: Move your project to a shorter path (e.g., `C:\projects\chess`) if errors persist.

### 4. Detailed Logging
To see exactly where it fails, run the build with debug logging enabled:
```powershell
$env:DEBUG = "electron-builder"; npm run electron:build
```

## Step-by-Step Recovery Plan

1. **Terminate all running instances** of the app and Vite.
2. **Clear previous build artifacts**:
   ```powershell
   Remove-Item -Recurse -Force dist_electron, frontend/dist, backend/dist
   ```
3. **Clear the builder cache**:
   ```powershell
   Remove-Item -Recurse -Force $env:LOCALAPPDATA\electron-builder\Cache
   ```
4. **Retry the build with logging**:
   ```powershell
   npm run electron:build
   ```

If you see a specific error message after doing this, please share the **last 20 lines** of the output.
