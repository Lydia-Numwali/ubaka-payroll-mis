# VS Code Setup Guide

## Fixing TypeScript Errors

If you see TypeScript errors about missing files in `src/renderer/main.tsx`, it means VS Code is confused about the project structure. Here's how to fix it:

### Option 1: Use the Workspace File (Recommended)

1. Open the workspace file:
   ```
   File > Open Workspace from File > ubaka-workspace.code-workspace
   ```

2. This will open VS Code with proper folder structure:
   - 🔧 Backend (backend/)
   - 🎨 Frontend (frontend/)
   - 📁 Root (.)

3. Each folder has its own TypeScript configuration
4. No more path confusion!

### Option 2: Reload VS Code Window

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Reload Window" and select it
3. This clears TypeScript cache

### Option 3: Restart TypeScript Server

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "TypeScript: Restart TS Server"
3. Select it to restart

## Project Structure

```
ubaka-payroll-mis/
├── backend/           # Node.js + Express API
│   ├── src/          # TypeScript source
│   ├── tsconfig.json # Backend TypeScript config
│   └── package.json  # Backend dependencies
│
├── frontend/         # Electron + React App
│   ├── src/         # React source
│   ├── electron/    # Electron main process
│   ├── tsconfig.json # Frontend TypeScript config
│   └── package.json  # Frontend dependencies
│
└── No root tsconfig.json (by design!)
```

## Important Notes

- **No root `tsconfig.json`**: This is intentional! Backend and frontend are separate projects
- **Separate `node_modules`**: Each project has its own dependencies
- **Separate TypeScript configs**: Backend uses CommonJS, Frontend uses ES modules

## VS Code Settings

The project includes:
- `.vscode/settings.json` - Editor settings
- `ubaka-workspace.code-workspace` - Multi-root workspace configuration

## Still Having Issues?

1. **Delete VS Code cache:**
   ```bash
   rm -rf ~/.vscode
   ```

2. **Check for stray tsconfig.json:**
   ```bash
   find . -name "tsconfig.json" -not -path "*/node_modules/*"
   ```
   Should only show:
   - `./backend/tsconfig.json`
   - `./frontend/tsconfig.json`
   - `./frontend/tsconfig.node.json`

3. **Clear TypeScript cache:**
   ```bash
   # Backend
   cd backend
   rm -rf node_modules/.cache
   rm -rf dist
   
   # Frontend
   cd frontend
   rm -rf node_modules/.cache
   rm -rf dist
   ```

4. **Reinstall dependencies:**
   ```bash
   # Backend
   cd backend
   rm -rf node_modules package-lock.json
   npm install
   
   # Frontend
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

## Recommended Extensions

- **ESLint** - Microsoft
- **Prettier** - Prettier
- **TypeScript** - Built-in (keep updated)

## Tips

- Use the workspace file for best experience
- Each terminal should run in the appropriate folder (backend or frontend)
- Backend runs on port 5000, Frontend on port 3000
