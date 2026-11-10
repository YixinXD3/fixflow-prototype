import base64
import concurrent.futures
import http.client
import json
import tempfile
import threading
import unittest
from io import BytesIO
from pathlib import Path

from backend.server import Server, wsgi_app
from backend.service import ApiError, Service


class WorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        cls.path=Path(cls.temp.name)/'template.sqlite3'
        s=Service(cls.path)
        s.bootstrap('manager@example.test','Local-test-password-2026',True)

    @classmethod
    def tearDownClass(cls): cls.temp.cleanup()

    def setUp(self):
        import sqlite3
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.db=Path(self.tmp.name)/'test.sqlite3'
        with sqlite3.connect(self.path) as source, sqlite3.connect(self.db) as target: source.backup(target)
        source.close();target.close()
        self.s=Service(self.db)
        with self.s.connect() as db:
            self.users={r['email'].split('@')[0]:dict(r) for r in db.execute('SELECT id,email,display_name,role FROM users')}
        self.m,self.c,self.other,self.t,self.h=(self.users[x] for x in ('manager','alex','sam','jordan','taylor'))
        self.j=self.call('POST','/api/repairs',{'device':'Demo phone','type':'Phone','category':'Screen','description':'Cracked display'},self.c)

    def call(self,method,path,data=None,user=None): return self.s.dispatch(method,path,data or {},user or self.m)
    def detail(self,user=None): return self.call('GET','/api/repairs/'+self.j['id'],user=user or self.m)
    def act(self,action,data=None,user=None):
        r=self.call('POST','/api/repairs/'+self.j['id']+'/'+action,{'expectedVersion':self.detail()['version'],**(data or {})},user)
        return r
    def error(self,code,fn):
        with self.assertRaises(ApiError) as e: fn()
        self.assertEqual(e.exception.status,code)
    def start(self):
        self.act('assignment',{'technicianId':self.t['id']})
        return self.act('start',user=self.t)
    def proposal(self): return self.act('approval-requests',{'reason':'Display failure','description':'Replace display','additionalCost':'99.00','revisedTotal':'129.00'})

    def test_end_to_end_roles_completion_and_restart(self):
        self.start()
        self.act('handovers',{'tests':'Connector tested','finding':'Display damaged','next':'Replace module'},self.t)
        self.act('public-updates',{'reason':'Replacement underway','nextAction':'Functional checks','progress':60},self.t)
        self.act('messages',{'body':'Please retain the old part.'},self.c)
        self.act('ready-for-confirmation',user=self.t)
        self.assertEqual(self.detail(self.c)['status'],'Awaiting Customer Confirmation')
        self.error(403,lambda:self.act('confirm-completion',user=self.t))
        self.act('confirm-completion',user=self.c)
        restarted=Service(self.db)
        j=restarted.dispatch('GET','/api/repairs/'+self.j['id'],{},self.c)
        self.assertEqual(j['status'],'Completed');self.assertEqual(j['messages'][0]['body'],'Please retain the old part.')
        self.assertIsNotNone(j['completion'])
        self.assertNotIn('handovers',j);self.assertNotIn('logs',j);self.assertNotIn('parts',j)
        self.error(409,lambda:self.act('confirm-completion',user=self.c))

    def test_ownership_and_role_enforcement(self):
        self.assertEqual(self.call('GET','/api/repairs',user=self.other),[])
        self.error(404,lambda:self.detail(self.other))
        self.error(404,lambda:self.detail(self.t))
        self.error(403,lambda:self.act('assignment',{'technicianId':self.t['id']},self.c))
        self.error(403,lambda:self.call('POST','/api/users',{'role':'manager'},self.c))
        self.error(403,lambda:self.act('start',user=self.c))

    def test_independent_blockers_and_explicit_resume(self):
        self.start();self.act('help-requests',{'helperId':self.h['id'],'problem':'Need diagnostic advice','blocking':True},self.t)
        self.act('parts-requests',{'description':'Display','quantity':1,'blocking':True},self.t)
        j=self.proposal();aid=j['current_approval_request_id'];hid=j['help'][0]['id'];pid=j['parts'][0]['id']
        self.error(409,lambda:self.act('resume',user=self.t))
        self.call('POST',f'/api/help-requests/{hid}/resolve',{'expectedVersion':self.detail()['version']},self.t)
        self.assertEqual(len(self.detail()['blockers']),2)
        self.call('POST',f'/api/approval-requests/{aid}/response',{'expectedVersion':self.detail()['version'],'decision':'approved'},self.c)
        self.assertEqual(self.detail()['status'],'Waiting');self.assertEqual(len(self.detail()['blockers']),1)
        self.call('PATCH',f'/api/parts-requests/{pid}',{'expectedVersion':self.detail()['version'],'status':'Received','nextAction':'Fit display'})
        self.assertEqual(self.detail()['status'],'Waiting');self.assertEqual(self.detail()['blockers'],[])
        self.act('resume',user=self.t);self.assertEqual(self.detail()['status'],'In Progress')

    def test_proposal_revisions_preserve_decline_and_atomic_invalid_replacement(self):
        j=self.proposal();aid=j['current_approval_request_id']
        self.call('POST',f'/api/approval-requests/{aid}/response',{'expectedVersion':j['version'],'decision':'declined'},self.c)
        before=self.detail()
        self.error(400,lambda:self.act('approval-requests',{'reason':'New','description':'Repair','additionalCost':'-1'}))
        self.assertEqual(self.detail()['approvals'],before['approvals'])
        j=self.proposal();self.assertNotEqual(aid,j['current_approval_request_id'])
        old=next(a for a in j['approvals'] if a['id']==aid)
        self.assertEqual(old['status'],'superseded');self.assertEqual(old['response']['decision'],'declined')
        self.error(409,lambda:self.call('POST',f'/api/approval-requests/{aid}/response',{'expectedVersion':j['version'],'decision':'approved'},self.c))

    def test_clarification_requires_text_zero_cost_and_duplicate_protection(self):
        j=self.act('approval-requests',{'reason':'Warranty','description':'Inspect','additionalCost':'0'})
        path='/api/approval-requests/'+j['current_approval_request_id']+'/response'
        self.error(400,lambda:self.call('POST',path,{'expectedVersion':j['version'],'decision':'clarification'},self.c))
        self.call('POST',path,{'expectedVersion':j['version'],'decision':'clarification','note':'Which component?'},self.c)
        self.error(409,lambda:self.call('POST',path,{'expectedVersion':self.detail()['version'],'decision':'approved'},self.c))
        self.assertEqual(self.detail()['approvals'][0]['response']['note'],'Which component?')

    def test_two_concurrent_updates_only_one_succeeds(self):
        version=self.j['version'];path='/api/repairs/'+self.j['id']+'/assignment'
        def assign(t):
            try:self.call('POST',path,{'expectedVersion':version,'technicianId':t['id']});return 200
            except ApiError as e:return e.status
        with concurrent.futures.ThreadPoolExecutor(2) as pool: results=list(pool.map(assign,[self.t,self.h]))
        self.assertEqual(sorted(results),[200,409]);self.assertEqual(len(self.detail()['assignments']),1)

    def test_retried_repair_creation_is_idempotent(self):
        import uuid
        data={'requestKey':str(uuid.uuid4()),'device':'Retry phone','type':'Phone','category':'Power','description':'No power'}
        a=self.call('POST','/api/repairs',data,self.c);b=self.call('POST','/api/repairs',data,self.c)
        self.assertEqual(a['id'],b['id']);self.assertEqual(a['version'],b['version'])
        self.error(409,lambda:self.call('POST','/api/repairs',{**data,'description':'Changed'},self.c))
        self.error(409,lambda:self.call('POST','/api/repairs',data,self.other))

    def test_help_recipient_private_discussion_and_acceptance(self):
        self.start();j=self.act('help-requests',{'helperId':self.h['id'],'problem':'Advice','blocking':False},self.t)
        hid=j['help'][0]['id'];base='/api/help-requests/'+hid
        self.error(409,lambda:self.call('POST',base+'/comments',{'expectedVersion':j['version'],'body':'Reply'},self.h))
        self.error(404,lambda:self.call('GET',base,user=self.users['marcus']))
        self.call('POST',base+'/accept',{'expectedVersion':j['version']},self.h)
        self.call('POST',base+'/comments',{'expectedVersion':self.detail()['version'],'body':'Check connector'},self.h)
        self.assertEqual(self.call('GET',base,user=self.t)['comments'][0]['body'],'Check connector')
        self.assertEqual(self.detail()['status'],'In Progress')
        self.error(403,lambda:self.call('POST',base+'/resolve',{'expectedVersion':self.detail()['version']},self.h))
        self.call('POST',base+'/resolve',{'expectedVersion':self.detail()['version']},self.t)
        self.error(409,lambda:self.call('POST',base+'/comments',{'expectedVersion':self.detail()['version'],'body':'Late'},self.t))

    def test_blocker_text_respects_private_help_after_reassignment(self):
        self.start()
        secret='Fictional private diagnostic detail'
        self.act('help-requests',{'helperId':self.h['id'],'problem':secret,'blocking':True},self.t)
        manager=self.detail()
        self.assertNotIn(secret,json.dumps(manager))
        self.assertIn('Technical help: Unresolved request',manager['blockers'])
        self.assertIn(secret,json.dumps(self.detail(self.t)['blockers']))
        self.act('assignment',{'technicianId':self.users['marcus']['id']})
        new_owner=self.detail(self.users['marcus'])
        self.assertNotIn(secret,json.dumps(new_owner))
        self.error(409,lambda:self.act('resume',user=self.users['marcus']))
        try:self.act('resume',user=self.users['marcus'])
        except ApiError as error:self.assertNotIn(secret,error.message)

    def test_reassignment_keeps_handover_and_revokes_old_owner(self):
        self.start();self.act('handovers',{'tests':'Test','finding':'Finding','next':'Next'},self.t)
        j=self.act('assignment',{'technicianId':self.h['id']})
        self.assertEqual(self.detail(self.h)['handovers'][0]['author_id'],self.t['id'])
        self.error(404,lambda:self.detail(self.t))
        self.assertEqual(len(j['assignments']),2)

    def test_staff_only_photos_and_non_image_rejection(self):
        self.start();version=self.detail()['version']
        self.error(400,lambda:self.act('attachments',{'filename':'bad.svg','visibility':'internal','content':base64.b64encode(b'<svg/>').decode()},self.t))
        self.assertEqual(self.detail()['version'],version)
        j=self.act('attachments',{'filename':'test.png','visibility':'internal','content':base64.b64encode(b'\x89PNG\r\n\x1a\nfictional').decode()},self.t)
        aid=j['attachments'][0]['id'];self.assertEqual(self.detail(self.c)['attachments'],[])
        self.error(404,lambda:self.s.attachment(aid,self.c))
        self.assertEqual(self.s.attachment(aid,self.m)['mime'],'image/png')

    def test_parts_history_order_reference_and_no_automatic_resume(self):
        self.start();j=self.act('parts-requests',{'description':'Battery'},self.t);p=j['parts'][0];path='/api/parts-requests/'+p['id']
        self.error(400,lambda:self.call('PATCH',path,{'expectedVersion':j['version'],'status':'Ordered','nextAction':'Wait'}))
        self.call('PATCH',path,{'expectedVersion':j['version'],'status':'Ordered','nextAction':'Wait','procurement':{'orderReference':'DEMO-1','website':'https://example.com'}})
        j=self.detail();self.assertEqual(j['status'],'Waiting');self.assertEqual(len(j['parts'][0]['history']),1)
        self.error(400,lambda:self.call('PATCH',path,{'expectedVersion':j['version'],'status':'Received','nextAction':'Fit','procurement':{'website':'javascript:alert(1)'}}))

    def test_authentication_hashes_and_customer_registration_cannot_promote(self):
        with self.s.connect() as db:
            u=self.s.create_user(db,{'email':'new@example.test','name':'New','password':'A-strong-test-password','role':'manager'})
            stored=db.execute('SELECT password_hash FROM users WHERE id=?',(u['id'],)).fetchone()[0]
        self.assertEqual(u['role'],'customer');self.assertNotIn('A-strong-test-password',stored)
        self.error(401,lambda:self.s.login({'email':u['email'],'password':'wrong-password'}))
        _,token,_=self.s.login({'email':u['email'],'password':'A-strong-test-password'})
        self.assertEqual(self.s.authenticate(token)['id'],u['id'])
        self.error(401,lambda:self.s.authenticate('invalid'))

    def test_http_cookies_csrf_and_database_files_not_public(self):
        server=Server(('127.0.0.1',0),self.s);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        self.addCleanup(server.server_close);self.addCleanup(server.shutdown)
        host=f'127.0.0.1:{server.server_port}';origin='http://'+host
        def request(method,path,data=None,cookie='',csrf='',request_origin=origin):
            c=http.client.HTTPConnection(host,timeout=5)
            c.request(method,path,json.dumps(data) if data is not None else None,{'Content-Type':'application/json','Origin':request_origin,'Cookie':cookie,'X-CSRF-Token':csrf})
            r=c.getresponse();out=(r.status,dict(r.getheaders()),r.read());c.close();return out
        status,headers,body=request('POST','/api/auth/login',{'email':'manager@example.test','password':'Local-test-password-2026'})
        self.assertEqual(status,200);self.assertIn('HttpOnly',headers['Set-Cookie'])
        cookie=headers['Set-Cookie'].split(';')[0];csrf=json.loads(body)['csrf']
        self.assertEqual(request('GET','/api/auth/me',cookie=cookie)[0],200)
        self.assertEqual(request('POST','/api/auth/logout',{},cookie=cookie)[0],403)
        self.assertEqual(request('POST','/api/auth/logout',{},cookie=cookie,csrf=csrf,request_origin='https://evil.test')[0],403)
        for path in ('/.data/fixflow.sqlite3','/backend/schema.sql','/../backend/service.py','/web/../../backend/service.py'):
            self.assertEqual(request('GET',path)[0],404)
        self.assertEqual(request('GET','/')[0],200)
        self.assertEqual(request('GET','/assets/favicon.svg')[0],200)
        self.assertEqual(request('GET','/web/app.js')[0],200)
        self.assertEqual(request('GET','/api/health')[0],200)
        self.assertEqual(request('POST','/api/auth/logout',{},cookie=cookie,csrf=csrf)[0],200)
        self.assertEqual(request('GET','/api/auth/me',cookie=cookie)[0],401)

    def test_production_wsgi_adapter_secure_cookie_and_origin(self):
        app=wsgi_app(self.s,True,'https://fixflow.example.test')
        def request(path,data=None,cookie='',csrf='',origin='https://fixflow.example.test'):
            payload=json.dumps(data).encode() if data is not None else b'';result={}
            env={'REQUEST_METHOD':'POST' if data is not None else 'GET','PATH_INFO':path,'wsgi.input':BytesIO(payload),'CONTENT_TYPE':'application/json','CONTENT_LENGTH':str(len(payload)),'HTTP_ORIGIN':origin,'HTTP_COOKIE':cookie,'HTTP_X_CSRF_TOKEN':csrf,'REMOTE_ADDR':'127.0.0.1'}
            def start(status,headers):result.update(status=status,headers=dict(headers))
            result['body']=b''.join(app(env,start));return result
        r=request('/api/auth/login',{'email':'manager@example.test','password':'Local-test-password-2026'})
        self.assertEqual(r['status'],'200 OK');self.assertIn('Secure',r['headers']['Set-Cookie'])
        cookie=r['headers']['Set-Cookie'].split(';')[0];csrf=json.loads(r['body'])['csrf']
        self.assertEqual(request('/api/auth/me',cookie=cookie)['status'],'200 OK')
        self.assertEqual(request('/api/auth/logout',{},cookie,csrf,origin='https://evil.test')['status'],'403 Forbidden')
        self.assertEqual(request('/api/auth/logout',{},cookie,csrf)['status'],'200 OK')

    def test_backup_restore_with_history_and_attachments(self):
        import sqlite3
        self.start();self.act('handovers',{'tests':'T','finding':'F','next':'N'},self.t)
        photo=self.act('attachments',{'filename':'backup.png','visibility':'internal','content':base64.b64encode(b'\x89PNG\r\n\x1a\ntest-backup').decode()},self.t)['attachments'][0]['id']
        backup=Path(self.tmp.name)/'backup.sqlite3'
        with self.s.connect() as source:
            target=sqlite3.connect(backup)
            try:source.backup(target)
            finally:target.close()
        restored=Service(backup)
        j=restored.dispatch('GET','/api/repairs/'+self.j['id'],{},self.t)
        self.assertEqual(j['handovers'][0]['tests'],'T')
        self.assertEqual(j['assigned_technician_id'],self.t['id'])
        self.assertEqual(restored.attachment(photo,self.t)['content'],b'\x89PNG\r\n\x1a\ntest-backup')


if __name__=='__main__': unittest.main()
