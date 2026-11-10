"""Consistent SQLite backup including WAL changes: python -m backend.backup DESTINATION"""
import argparse
import os
import sqlite3
from pathlib import Path


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination')
    args=parser.parse_args()
    source=Path(os.environ.get('FIXFLOW_DB',str(Path(__file__).resolve().parents[1]/'.data'/'fixflow.sqlite3'))).resolve()
    target=Path(args.destination).resolve()
    if not source.is_file(): parser.error('Source database does not exist.')
    if target.exists(): parser.error('Choose a new destination; existing files are never overwritten.')
    target.parent.mkdir(parents=True,exist_ok=True)
    src=sqlite3.connect(source.as_uri()+'?mode=ro',uri=True)
    dst=sqlite3.connect(target)
    try:
        src.backup(dst)
        if dst.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise RuntimeError('Backup integrity check failed.')
    finally: dst.close();src.close()
    print('Backup saved. Store it outside the application service and outside Git.')


if __name__=='__main__': main()
