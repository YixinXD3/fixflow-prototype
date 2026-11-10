"""Package a clean current-branch clone with genuine Git history, never the live workspace."""
import argparse
import hashlib
import subprocess
import tempfile
import zipfile
from pathlib import Path
from urllib.parse import urlsplit


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True,help='New absolute ZIP destination outside the repository.')
    args=parser.parse_args()
    repo=Path(__file__).resolve().parents[2]
    target=Path(args.output).expanduser().resolve()
    if target.exists():parser.error('Destination exists; choose a new filename.')
    if target.is_relative_to(repo):parser.error('Keep the package outside the source repository.')
    def git(*args,cwd=repo):return subprocess.check_output(['git',*args],cwd=cwd,text=True).strip()
    if git('status','--porcelain'):parser.error('Commit/review changes first; packaging requires a clean checkout.')
    branch=git('branch','--show-current')
    if not branch:parser.error('Check out the intended submission branch first.')
    sha=git('rev-parse','HEAD');remote=git('remote','get-url','origin')
    url=urlsplit(remote)
    if url.scheme!='https' or url.hostname!='github.com' or url.username or url.password:parser.error('Use a public-form HTTPS GitHub origin without embedded credentials.')
    with tempfile.TemporaryDirectory() as temp:
        clone=Path(temp)/'FixFlow'
        subprocess.run(['git','-c','core.hooksPath=/dev/null','clone','--quiet','--no-hardlinks','--single-branch','--branch',branch,'--',str(repo),str(clone)],check=True)
        subprocess.run(['git','remote','set-url','origin',remote],cwd=clone,check=True)
        if git('rev-parse','HEAD',cwd=clone)!=sha:raise RuntimeError('Clone revision mismatch.')
        subprocess.run(['git','fsck','--no-reflogs'],cwd=clone,check=True,stdout=subprocess.DEVNULL)
        target.parent.mkdir(parents=True,exist_ok=True)
        with zipfile.ZipFile(target,'x',compression=zipfile.ZIP_DEFLATED) as archive:
            for file in sorted(clone.rglob('*')):
                if file.is_file():archive.write(file,file.relative_to(clone.parent))
        with zipfile.ZipFile(target) as archive:
            if archive.testzip() is not None:raise RuntimeError('ZIP integrity check failed.')
            if 'FixFlow/.git/HEAD' not in archive.namelist():raise RuntimeError('Git history missing.')
    checksum=hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_suffix(target.suffix+'.sha256').write_text(checksum+'  '+target.name+'\n')
    print('Packaged branch:',branch)
    print('Commit:',sha)
    print('ZIP:',target)
    print('SHA256:',checksum)


if __name__=='__main__':main()
