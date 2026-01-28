# Port Conflict Troubleshooting Guide

> [!NOTE]
> The application has been updated to use Electron IPC (Inter-Process Communication) instead of a local webserver. This eliminates most "port in use" issues.

If you are still seeing port conflict errors, it might be from the frontend development server (port 5173).

## 🔍 How to Identify the Process

On Windows, you can use the PowerSHeLL or Command Prompt to find what's using the port.

### Option 1: PowerShell (Recommended)
Run this command to find the Process ID (PID) using port 3001:
```powershell
Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningProcess
```

### Option 2: Command Prompt
```cmd
netstat -ano | findstr :3001
```
The last number in the output is the **PID**.

---

## 🛠 Possible Solutions

### 1. Kill the Existing Process
Once you have the **PID** from the steps above, you can stop that process:

**Using PowerShell:**
```powershell
Stop-Process -Id <PID> -Force
```

**Using Task Manager:**
1. Open **Task Manager** (Ctrl + Shift + Esc).
2. Go to the **Details** tab.
3. Find the PID you identified.
4. Right-click and select **End Task**.

### 2. Change the Application Port
If you want to run the application on a different port, you can change it in the backend configuration.

1. Open `backend/.env` (create it if it doesn't exist by copying `.env.example`).
2. Change the `PORT` variable:
   ```env
   PORT=3002
   ```
3. Update the frontend to point to the new port if necessary (usually in a config file or `.env` in the frontend folder).

### 3. Automatically Find an Available Port (Developer Tip)
You can modify `backend/src/index.ts` to automatically try the next available port if 3001 is taken.

---

## 🚀 Proactive Prevention
- Always ensure you close the terminal or stop the dev server (Ctrl + C) before starting a new one.
- In Electron development, sometimes a "ghost" process stays alive if the app crashed. Checking Task Manager for `node.exe` or your app name can help.
