import subprocess
import sys
import time
import threading
import signal
import os

def stream_output(process, prefix):
    for line in iter(process.stdout.readline, b''):
        sys.stdout.write(f"[{prefix}] {line.decode('utf-8', errors='replace')}")
    process.stdout.close()

def main():
    print("=" * 60)
    print("🚀 Starting API and Worker Orchestrator")
    print("=" * 60)

    # Set up environment variables
    env = os.environ.copy()

    # Start API process
    api_cmd = ["uvicorn", "api.main:app", "--host", "localhost", "--port", "8000", "--reload"]
    print(f"Starting API: {' '.join(api_cmd)}")
    api_proc = subprocess.Popen(api_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env)

    # Start Worker process
    # Use venv python directly if it exists
    python_exec = sys.executable
    if os.path.exists(".venv/Scripts/python.exe"):
        python_exec = ".venv/Scripts/python.exe"
    elif os.path.exists(".venv/bin/python"):
        python_exec = ".venv/bin/python"

    worker_cmd = [python_exec, "worker/run.py"]
    print(f"Starting Worker: {' '.join(worker_cmd)}")
    worker_proc = subprocess.Popen(worker_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env)

    api_thread = threading.Thread(target=stream_output, args=(api_proc, "API"))
    worker_thread = threading.Thread(target=stream_output, args=(worker_proc, "WORKER"))

    api_thread.daemon = True
    worker_thread.daemon = True

    api_thread.start()
    worker_thread.start()

    def signal_handler(sig, frame):
        print("\n" + "=" * 60)
        print("🛑 Shutting down API and Worker...")
        print("=" * 60)
        api_proc.terminate()
        worker_proc.terminate()
        
        try:
            api_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            api_proc.kill()
            
        try:
            worker_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            worker_proc.kill()
            
        print("✅ Shutdown complete.")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    try:
        # Keep main thread alive
        while True:
            time.sleep(1)
            # Check if any process died unexpectedly
            if api_proc.poll() is not None:
                print("❌ API process died unexpectedly. Shutting down...")
                signal_handler(None, None)
            if worker_proc.poll() is not None:
                print("❌ Worker process died unexpectedly. Shutting down...")
                signal_handler(None, None)
    except KeyboardInterrupt:
        # Handled by signal_handler
        pass

if __name__ == "__main__":
    main()
