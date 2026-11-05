"""Run with python -m backend.server. Python 3.12+; no pip dependencies."""
import argparse
import hashlib
import json
import mimetypes
import os
import secrets
import sqlite3
import threading
import time
from types import SimpleNamespace
from http import HTTPStatus
from email.message import Message
from collections import defaultdict, deque
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .service import ApiError, Service, check_password, password_hash, require, text

ROOT = Path(__file__).resolve().parents[1]


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, service, production=False, public_origin=''):
        self.service, self.production, self.public_origin = service, production, public_origin.rstrip('/')
        self.attempts, self.rate_lock = defaultdict(deque), threading.Lock()
        super().__init__(address, Handler)


class Handler(BaseHTTPRequestHandler):
    server_version = 'FixFlow'

    def log_message(self, fmt, *args):
        # Never log bodies, passwords, query strings or session cookies.
        print(f'{self.address_string()} {self.command} {urlparse(self.path).path} {args[1] if len(args)>1 else ""}', flush=True)

    def send(self, status, content, mime='application/json', extra=()):
        if mime == 'application/json': content = json.dumps(content, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
        if self.server.production: self.send_header('Strict-Transport-Security', 'max-age=31536000')
        for k,v in extra: self.send_header(k,v)
        self.end_headers()
        self.wfile.write(content)

    def token(self):
        jar=cookies.SimpleCookie()
        try: jar.load(self.headers.get('Cookie',''))
        except cookies.CookieError: return ''
        return jar['fixflow_session'].value if 'fixflow_session' in jar else ''

    def cookie(self, token, expired=False):
        return ('Set-Cookie',f'fixflow_session={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={0 if expired else 43200}' + ('; Secure' if self.server.production else ''))

    def rate_limit(self):
        ip=self.client_address[0]; at=time.monotonic()
        with self.server.rate_lock:
            if len(self.server.attempts)>10000:
                for key in list(self.server.attempts):
                    if not self.server.attempts[key] or at-self.server.attempts[key][-1]>900: del self.server.attempts[key]
            bucket=self.server.attempts[ip]
            while bucket and at-bucket[0]>900: bucket.popleft()
            require(len(bucket)<30,'Too many account attempts. Try again in 15 minutes.',429)
            bucket.append(at)

    def handle_request(self):
        path=urlparse(self.path).path
        try:
            data={}
            if self.command not in ('GET','HEAD'):
                origin=self.headers.get('Origin','').rstrip('/')
                expected=self.server.public_origin or ('http://' + self.headers.get('Host',''))
                require(origin==expected,'Request origin does not match this service.',403)
                require(self.headers.get('Content-Type','').split(';')[0]=='application/json','Use application/json.',415)
                try: length=int(self.headers.get('Content-Length','0'))
                except ValueError: raise ApiError(400,'Invalid body length.')
                require(0<length<=7_100_000,'Request is empty or too large.',413)
                try: data=json.loads(self.rfile.read(length))
                except (ValueError,UnicodeError): raise ApiError(400,'Invalid JSON body.')
                require(isinstance(data,dict),'JSON body must be an object.')
            service=self.server.service
            if path=='/api/health' and self.command=='GET':
                with service.connect() as db:
                    db.execute('SELECT 1 FROM repair_jobs LIMIT 1').fetchall()
                return self.send(200,{'status':'ok','database':'connected','schemaVersion':1})
            if path=='/api/auth/register' and self.command=='POST':
                self.rate_limit()
                with service.connect() as db: user=service.create_user(db,data)
                return self.send(201,{'user':user})
            if path=='/api/auth/login' and self.command=='POST':
                self.rate_limit(); user,token,csrf=service.login(data)
                return self.send(200,{'user':user,'csrf':csrf},extra=[self.cookie(token)])
            if path.startswith('/api/'):
                token=self.token();user=service.authenticate(token)
                if self.command!='GET': require(secrets.compare_digest(self.headers.get('X-CSRF-Token',''),user['csrf']),'Session verification failed. Reload and sign in again.',403)
                csrf=user.pop('csrf')
                if path=='/api/auth/me' and self.command=='GET': return self.send(200,{'user':user,'csrf':csrf})
                if path=='/api/auth/logout' and self.command=='POST':
                    with service.connect() as db: db.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),))
                    return self.send(200,{'ok':True},extra=[self.cookie('',True)])
                if path=='/api/auth/password' and self.command=='POST':
                    old,new=text(data,'currentPassword',128),text(data,'newPassword',128)
                    require(len(new)>=12,'Use at least 12 characters.')
                    with service.connect() as db:
                        row=service.one(db,'SELECT password_hash FROM users WHERE id=?',(user['id'],))
                        require(check_password(old,row['password_hash']),'Current password is incorrect.',403)
                        db.execute('UPDATE users SET password_hash=? WHERE id=?',(password_hash(new),user['id']))
                        db.execute('DELETE FROM sessions WHERE user_id=?',(user['id'],))
                    return self.send(200,{'ok':True},extra=[self.cookie('',True)])
                if path.startswith('/api/attachments/') and self.command=='GET':
                    a=service.attachment(path.rsplit('/',1)[-1],user)
                    return self.send(200,a['content'],a['mime'],[('Content-Disposition','inline')])
                return self.send(200,service.dispatch(self.command,path,data,user))
            require(self.command=='GET','Method not allowed.',405)
            if path in ('/','/index.html'): file=ROOT/'web'/'index.html'
            elif path.startswith('/web/') and Path(path).name in ('app.js','app.css'): file=ROOT/'web'/Path(path).name
            elif path.startswith('/assets/'):
                file=(ROOT/path.lstrip('/')).resolve();require(file.is_relative_to(ROOT/'assets'),'Not found.',404)
            else: raise ApiError(404,'Page not found.')
            require(file.is_file(),'Page not found.',404)
            mime=mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
            self.send(200,file.read_bytes(),mime)
        except ApiError as e: self.send(e.status,{'error':e.message})
        except sqlite3.IntegrityError: self.send(409,{'error':'This operation conflicts with an existing record. Reload and try again.'})
        except sqlite3.OperationalError:
            self.send(503,{'error':'Database temporarily unavailable. Your operation has not been confirmed; reload before retrying.'})
        except (BrokenPipeError,ConnectionResetError): pass
        except Exception:
            import traceback;traceback.print_exc()
            self.send(500,{'error':'The operation could not be completed. Reload before retrying.'})

    do_GET=handle_request
    do_POST=handle_request
    do_PATCH=handle_request


def wsgi_app(service, production, origin):
    """Use the same request/controller logic behind a production HTTP parser."""
    settings=SimpleNamespace(service=service,production=production,public_origin=origin,attempts=defaultdict(deque),rate_lock=threading.Lock())

    class WSGIHandler(Handler):
        def __init__(self,environ,start_response):
            self.server=settings
            self.command=environ['REQUEST_METHOD']
            self.path=environ.get('PATH_INFO','/')
            self.rfile=environ['wsgi.input']
            self.client_address=(environ.get('REMOTE_ADDR','unknown'),0)
            self.headers=Message()
            for key,value in environ.items():
                if key.startswith('HTTP_'): self.headers[key[5:].replace('_','-')]=value
            for key in ('CONTENT_TYPE','CONTENT_LENGTH'):
                if environ.get(key): self.headers[key.replace('_','-')]=environ[key]
            self.start_response=start_response
            self.result=[]

        def send(self,status,content,mime='application/json',extra=()):
            if mime=='application/json': content=json.dumps(content,ensure_ascii=False).encode()
            headers=[('Content-Type',mime),('Content-Length',str(len(content))),('Cache-Control','no-store'),('X-Content-Type-Options','nosniff'),('Referrer-Policy','same-origin'),('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")]
            if production: headers.append(('Strict-Transport-Security','max-age=31536000'))
            self.start_response(f'{status} {HTTPStatus(status).phrase}',headers+list(extra))
            self.result=[content]

    def application(environ,start_response):
        handler=WSGIHandler(environ,start_response)
        handler.handle_request()
        return handler.result
    return application


def main():
    parser=argparse.ArgumentParser(description='FixFlow API and website')
    parser.add_argument('--demo',action='store_true',help='Create fictional local accounts on an empty database.')
    parser.add_argument('--port',type=int,default=int(os.environ.get('PORT','8000')))
    args=parser.parse_args()
    production=os.environ.get('FIXFLOW_ENV')=='production'
    origin=os.environ.get('FIXFLOW_PUBLIC_ORIGIN','').rstrip('/')
    if production and (not origin.startswith('https://') or args.demo): parser.error('Production requires FIXFLOW_PUBLIC_ORIGIN=https://... and does not allow --demo.')
    service=Service(os.environ.get('FIXFLOW_DB',str(ROOT/'.data'/'fixflow.sqlite3')))
    with service.connect() as db: empty=not db.execute('SELECT 1 FROM users LIMIT 1').fetchone()
    if empty:
        password=os.environ.get('FIXFLOW_ADMIN_PASSWORD')
        if production and not password: parser.error('Set FIXFLOW_ADMIN_PASSWORD for first startup.')
        password=password or secrets.token_urlsafe(18)
        email=os.environ.get('FIXFLOW_ADMIN_EMAIL','manager@example.test')
        service.bootstrap(email,password,args.demo)
        if not production: print(f'LOCAL ACCOUNTS INITIALIZED. Manager: {email}\nInitial password: {password}\n'+('Demo accounts: jordan@example.test, taylor@example.test, marcus@example.test, alex@example.test, sam@example.test (same initial password).\n' if args.demo else ''),flush=True)
    bind='0.0.0.0' if production else '127.0.0.1'
    if production:
        from waitress import serve
        print(f'FixFlow production WSGI service on {bind}:{args.port}',flush=True)
        serve(wsgi_app(service,True,origin),host=bind,port=args.port,threads=8,max_request_body_size=7_100_000,channel_timeout=60)
        return
    server=Server((bind,args.port),service,production,origin)
    print(f'FixFlow listening on {bind}:{args.port}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()


if __name__=='__main__': main()
