"""Check the reorganized app's real paths and maintained document links."""
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT=Path(__file__).resolve().parents[2]
APP=ROOT/'apps'/'fixflow'
errors=[]
required=['AGENTS.md','README.md','apps/README.md','apps/fixflow/README.md','apps/fixflow/backend/schema.sql','apps/fixflow/backend/service.py','apps/fixflow/backend/server.py','apps/fixflow/backend/demo.py','apps/fixflow/web/index.html','apps/fixflow/public/index.html','apps/fixflow/run.py','apps/fixflow/requirements.txt','guides/getting-started.md','docs/README.md','infra/containers/fixflow.Dockerfile','infra/deployment/render.yaml','.github/workflows/backend-checks.yml','.github/workflows/fixflow-pages.yml']
for name in required:
    if not (ROOT/name).is_file():errors.append('Missing '+name)
for name in ['backend','web','assets','Dockerfile','render.yaml','app.js','index.html']:
    if (ROOT/name).exists():errors.append('Duplicate root application file/directory: '+name)

class Assets(HTMLParser):
    def __init__(self,html,base,backend=False):
        super().__init__();self.base,self.backend=base,backend;self.feed(html)
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key not in ('src','href') or not value or urlsplit(value).scheme or value.startswith('#'):continue
            path=urlsplit(value).path
            if self.backend and path.startswith('/assets/'):target=APP/'public'/path.lstrip('/')
            elif self.backend:target=APP/path.lstrip('/')
            else:target=self.base/path
            if not target.exists():errors.append('Missing HTML asset: '+str(target.relative_to(ROOT)))
Assets((APP/'web/index.html').read_text(),APP/'web',True)
Assets((APP/'public/index.html').read_text(),APP/'public')

for path in [ROOT/'README.md',ROOT/'apps/README.md',APP/'README.md',ROOT/'infra/README.md',*list((ROOT/'docs').rglob('*.md')),*list((ROOT/'infra/deployment').glob('*.md'))]:
    relative=path.relative_to(ROOT).as_posix()
    if '/history/' in relative or '/prototype/' in relative or path.name=='backend-verification.md':continue
    text=re.sub(r'```.*?```','',path.read_text(),flags=re.S)
    for value in re.findall(r'\]\(([^)]+)\)',text):
        value=value.strip('<>');parts=urlsplit(value)
        if parts.scheme or not parts.path:continue
        target=path.parent/unquote(parts.path)
        if not target.exists():errors.append(relative+': broken link '+value)

tracked=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
for name in tracked:
    if not name or not (ROOT/name).is_file():continue
    parts=Path(name).parts
    if any(p in ('.data','.venv','node_modules','__pycache__') for p in parts) or name.endswith(('.sqlite3','.sqlite3-wal','.sqlite3-shm','.env')):errors.append('Runtime/secret artifact tracked: '+name)
if errors:raise SystemExit('\n'.join(errors))
print('Submission paths, maintained Markdown links and HTML assets passed. No tracked runtime databases or environment files.')
print('Historical records and unchanged supplied guides/skills retain their original context and are excluded from current-link claims.')
