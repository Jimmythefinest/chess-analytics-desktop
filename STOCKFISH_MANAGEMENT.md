# Multi-Platform Stockfish Management

To make your Chess Analytics app truly portable across Windows, Linux, and macOS, you need to bundle the correct Stockfish binaries for each platform. 

The application is already configured to look for these binaries in the `backend/bin` directory of your project.

## 1. Binary Naming Convention
The backend code (`stockfish.ts`) expects the following naming convention in the `backend/bin` folder:

| Platform | Binary Name | Location |
|----------|-------------|----------|
| **Windows** | `stockfish.exe` | `backend/bin/stockfish.exe` |
| **Linux** | `stockfish` | `backend/bin/stockfish` |
| **macOS** | `stockfish` | `backend/bin/stockfish` |

> [!NOTE]
> Since Linux and macOS both use the name `stockfish`, you should separate them if you are building for both from a single machine, or ensure the build process picks the right one. However, the current `electron-builder` config bundles the entire `backend/bin` folder.

## 2. Where to Get Binaries

### Option A: Download Official Binaries (Recommended)
You can download pre-compiled binaries from the [Official Stockfish Website](https://stockfishchess.org/download/).
- **Windows**: Download the Windows version (e.g., AVX2 or BMI2) and rename the `.exe` to `stockfish.exe`.
- **Linux**: Download the Linux version and rename it to `stockfish`.
- **macOS**: Download the macOS version and rename it to `stockfish`.

### Option B: Compiling from Source
If you want maximum performance for a specific architecture:
```bash
git clone https://github.com/official-stockfish/Stockfish.git
cd Stockfish/src
make -j profile-build ARCH=x86-64-avx2 # Example for modern CPUs
```

## 3. Bundling with Electron
Your `electron-builder.yml` is already configured to include these binaries as `extraResources`:

```yaml
extraResources:
  - from: backend/bin
    to: backend/bin
    filter:
      - "**/*"
```

When the app is packaged:
- **Windows**: Binaries go into `resources/backend/bin/stockfish.exe`.
- **macOS**: Binaries go into `Contents/Resources/backend/bin/stockfish`.
- **Linux**: Binaries go into `resources/backend/bin/stockfish`.

## 4. How the Code Finds Them
I have already updated `backend/src/services/stockfish.ts` to use this logic:

```typescript
const isDev = process.env.NODE_ENV === 'development';
const resourcesPath = (process as any).resourcesPath;
const binPath = (isDev || !resourcesPath)
    ? path.join(__dirname, '../../bin')
    : path.join(resourcesPath, 'backend/bin');

const stockfishPaths = [
    path.join(binPath, process.platform === 'win32' ? 'stockfish.exe' : 'stockfish'),
    'stockfish', // Fallback to system path
    // ... other standard linux paths
];
```

## 5. Deployment Checklist
- [ ] **Permissions**: On Linux and macOS, ensure the bundled binary has execution permissions (`chmod +x`). `electron-builder` usually handles this during packaging.
- [ ] **Architecture**: For Windows `.exe`, use a generic architecture (like `x86-64-modern`) to ensure compatibility across different PCs.
- [ ] **Mac Notarization**: If distributing for macOS, remember that the bundled Stockfish binary must also be signed along with the app.
