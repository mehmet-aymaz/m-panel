import sys
import os

# Add current directory to path to import seed
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from seed import seed_db

if __name__ == "__main__":
    seed_db()
