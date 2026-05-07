import os
import subprocess
import sys

def run_command(command, cwd=None):
    print(f"Running: {command} in {cwd or os.getcwd()}")
    process = subprocess.Popen(command, shell=True, cwd=cwd)
    process.communicate()
    if process.returncode != 0:
        print(f"Error executing command: {command}")
        sys.exit(1)

def main():
    # 1. Build Frontend
    print("--- Building Frontend ---")
    frontend_dir = os.path.join(os.getcwd(), "frontend")
    # Pastikan node_modules terinstal
    if not os.path.exists(os.path.join(frontend_dir, "node_modules")):
        run_command("npm install", cwd=frontend_dir)
    run_command("npm run build", cwd=frontend_dir)

    # 2. Run Backend
    print("\n--- Starting Unified Server ---")
    backend_dir = os.path.join(os.getcwd(), "backend")
    venv_python = os.path.join(backend_dir, ".venv", "Scripts", "python.exe")
    
    if os.path.exists(venv_python):
        print(f"Using virtual environment: {venv_python}")
        # Jalankan uvicorn melalui python venv
        cmd = f'"{venv_python}" -m uvicorn app.main:app --reload --port 8000'
    else:
        print("Virtual environment not found, trying global python...")
        cmd = "python -m uvicorn app.main:app --reload --port 8000"

    try:
        run_command(cmd, cwd=backend_dir)
    except KeyboardInterrupt:
        print("\nStopping server...")

if __name__ == "__main__":
    main()
