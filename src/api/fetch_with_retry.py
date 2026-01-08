"""
Fetch Stock Data with Retry Logic
==================================
Wrapper script for main.py with robust error handling and retry mechanisms.
"""

import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime

MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds (will use exponential backoff)

def log(message):
    """Log message with timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")
    
    # Also write to log file
    log_file = Path(__file__).parent / "fetch_log.txt"
    with open(log_file, "a") as f:
        f.write(f"[{timestamp}] {message}\n")

def run_fetch(attempt=1):
    """Run the main.py script with timeout."""
    log(f"Attempt {attempt}/{MAX_RETRIES}: Starting stock data fetch...")
    
    try:
        # Run main.py with timeout (10 minutes per attempt)
        result = subprocess.run(
            [sys.executable, "main.py"],
            cwd=Path(__file__).parent,
            capture_output=True,
            text=True,
            timeout=600  # 10 minutes
        )
        
        # Log output
        if result.stdout:
            log(f"Output:\n{result.stdout}")
        
        if result.returncode == 0:
            log("✅ Fetch completed successfully")
            return True
        else:
            log(f"❌ Fetch failed with exit code {result.returncode}")
            if result.stderr:
                log(f"Error:\n{result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        log("⏱️  Fetch timed out (10 minutes)")
        return False
    except Exception as e:
        log(f"❌ Unexpected error: {e}")
        return False

def main():
    """Main function with retry logic."""
    log("="*60)
    log("Starting Stock Data Fetch with Retry")
    log("="*60)
    
    # Clear previous log
    log_file = Path(__file__).parent / "fetch_log.txt"
    if log_file.exists():
        log_file.unlink()
    
    for attempt in range(1, MAX_RETRIES + 1):
        success = run_fetch(attempt)
        
        if success:
            log("="*60)
            log("SUCCESS: Stock data fetched")
            log("="*60)
            sys.exit(0)
        
        # If not last attempt, wait before retrying
        if attempt < MAX_RETRIES:
            delay = RETRY_DELAY * (2 ** (attempt - 1))  # Exponential backoff
            log(f"Waiting {delay} seconds before retry...")
            time.sleep(delay)
    
    # All retries failed
    log("="*60)
    log("FAILURE: All retry attempts exhausted")
    log("="*60)
    sys.exit(1)

if __name__ == "__main__":
    main()
