"""Run the complete application from any working directory."""
import os
import runpy
import sys
from pathlib import Path

if __name__ == '__main__':
    app = Path(__file__).resolve().parent
    os.chdir(app)
    sys.path.insert(0, str(app))
    runpy.run_module('backend.server', run_name='__main__')
