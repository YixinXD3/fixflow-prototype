"""Transactional domain service. No browser-supplied identities are trusted."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path


class ApiError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message
        super().__init__(message)


def require(ok, message, status=400):
    if not ok:
        raise ApiError(status, message)


def now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds')


def uid():
    return str(uuid.uuid4())


def text(data, key, limit=1000, optional=False):
    value = data.get(key, '')
    require(isinstance(value, str), f'{key} must be text.')
    value = value.strip()
    require((optional or bool(value)) and len(value) <= limit, f'{key} is required and must be at most {limit} characters.')
    return value


def flag(data, key, default=False):
    value = data.get(key, default)
    require(type(value) is bool, f'{key} must be true or false.')
    return int(value)


def integer(data, key, low, high, default=None):
    value = data.get(key, default)
    require(type(value) is int and low <= value <= high, f'{key} must be an integer between {low} and {high}.')
    return value


def money(data, key, optional=False):
    if optional and data.get(key) in (None, ''):
        return None
    try:
        require(not isinstance(data.get(key), bool), f'Invalid {key}.')
        value = Decimal(str(data[key]))
        require(value.is_finite() and 0 <= value <= 1000000 and value * 100 == (value * 100).to_integral_value(), f'Invalid {key}: use a nonnegative amount with up to two decimals.')
        return int(value * 100)
    except (InvalidOperation, KeyError, ValueError):
        raise ApiError(400, f'Invalid {key}.')


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    value = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f'{salt}:{value}'


def check_password(password, encoded):
    return hmac.compare_digest(password_hash(password, encoded.split(':')[0]), encoded)


class Service:
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            if db.execute('PRAGMA user_version').fetchone()[0] > 1:
                raise RuntimeError('This database was created by a newer version of FixFlow. Do not downgrade it.')
            db.executescript(Path(__file__).with_name('schema.sql').read_text())
            db.execute('PRAGMA journal_mode=WAL')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    @staticmethod
    def rows(db, query, args=()):
        return [dict(x) for x in db.execute(query, args)]

    @staticmethod
    def one(db, query, args=(), message='Record not found.'):
        row = db.execute(query, args).fetchone()
        require(row is not None, message, 404)
        return dict(row)

    @staticmethod
    def insert(db, table, **values):
        # Table and column names are internal constants, never request parameters.
        db.execute(f'INSERT INTO {table} ({",".join(values)}) VALUES ({",".join("?" for _ in values)})', tuple(values.values()))

    def create_user(self, db, data, role='customer'):
        email = text(data, 'email', 254).lower()
        require('@' in email and '.' in email.rsplit('@', 1)[-1] and not any(c.isspace() for c in email), 'Enter a valid email address.')
        password = text(data, 'password', 128)
        require(len(password) >= 12, 'Use a password of at least 12 characters.')
        require(role in ('customer', 'technician', 'manager'), 'Invalid role.')
        user = dict(id=uid(), email=email, display_name=text(data, 'name', 100), role=role, created_at=now())
        try:
            self.insert(db, 'users', **user, password_hash=password_hash(password))
        except sqlite3.IntegrityError:
            raise ApiError(409, 'This email is already registered.')
        return user

    def bootstrap(self, email, password, demo=False):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT 1 FROM users LIMIT 1').fetchone():
                return False
            self.create_user(db, dict(email=email, password=password, name='Shop Manager'), 'manager')
            if demo:
                for email, name, role in [('jordan@example.test', 'Jordan Smith', 'technician'), ('taylor@example.test', 'Taylor Kim', 'technician'), ('marcus@example.test', 'Marcus Lee', 'technician'), ('alex@example.test', 'Alex Chen', 'customer'), ('sam@example.test', 'Sam Wilson', 'customer')]:
                    self.create_user(db, dict(email=email, password=password, name=name), role)
            return True

    def login(self, data):
        email, password = text(data, 'email', 254).lower(), text(data, 'password', 128)
        with self.connect() as db:
            row = db.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
            # Execute the expensive hash even for an unknown account.
            encoded = row['password_hash'] if row else ('00' * 16 + ':' + '00' * 64)
            require(check_password(password, encoded) and row is not None, 'Incorrect email or password.', 401)
            token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            db.execute('DELETE FROM sessions WHERE expires_at<?', (int(time.time()),))
            self.insert(db, 'sessions', token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=row['id'], csrf=csrf, expires_at=int(time.time()) + 43200)
            user = dict(row); user.pop('password_hash')
            return user, token, csrf

    def authenticate(self, token):
        with self.connect() as db:
            row = db.execute('SELECT u.id,u.email,u.display_name,u.role,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()
            require(row is not None, 'Please sign in.', 401)
            return dict(row)

    def job(self, db, jid, user):
        j = self.one(db, 'SELECT j.*,r.customer_id,r.device,r.description,r.type,r.category,r.customer_note,r.preferred_technician_id,r.submitted_at,u.display_name AS customer_name,t.display_name AS technician_name FROM repair_jobs j JOIN repair_requests r ON r.id=j.request_id JOIN users u ON u.id=r.customer_id LEFT JOIN users t ON t.id=j.assigned_technician_id WHERE j.id=?', (jid,))
        allowed = user['role'] == 'manager' or (user['role'] == 'customer' and j['customer_id'] == user['id']) or (user['role'] == 'technician' and j['assigned_technician_id'] == user['id'])
        require(allowed, 'Repair not found.', 404)
        return j

    def blockers(self, db, j, viewer=None):
        result = ['Part: ' + x['part_description'] for x in db.execute("SELECT part_description FROM parts_requests WHERE job_id=? AND blocking=1 AND status<>'Received'", (j['id'],))]
        for h in db.execute("SELECT problem,requester_id,helper_id FROM help_requests WHERE job_id=? AND blocking=1 AND status<>'Resolved'", (j['id'],)):
            participant = viewer and viewer['id'] in (h['requester_id'],h['helper_id'])
            result.append('Technical help: ' + (h['problem'] if participant else 'Unresolved request'))
        if j['current_approval_request_id']:
            p = self.one(db, 'SELECT * FROM approval_requests WHERE id=?', (j['current_approval_request_id'],))
            if p['status'] in ('pending', 'declined', 'clarification'):
                result.append('Customer decision pending' if p['status'] == 'pending' else 'Manager follow-up: ' + p['status'])
        return result

    def detail(self, db, j, user):
        jid = j['id']
        for key, table in [('updates','public_updates'), ('messages','customer_messages'), ('approvals','approval_requests')]:
            j[key] = self.rows(db, f'SELECT * FROM {table} WHERE job_id=? ORDER BY rowid', (jid,))
        for p in j['approvals']:
            p['response'] = next(iter(self.rows(db, 'SELECT * FROM approval_responses WHERE approval_request_id=?', (p['id'],))), None)
            p['additional_cost'] /= 100
            if p['revised_total'] is not None: p['revised_total'] /= 100
        j['completion'] = next(iter(self.rows(db, 'SELECT * FROM completion_confirmations WHERE job_id=?', (jid,))), None)
        j['attachments'] = self.rows(db, 'SELECT id,filename,mime,visibility,created_at FROM attachments WHERE job_id=?' + (" AND visibility='public'" if user['role'] == 'customer' else ''), (jid,))
        if user['role'] != 'customer':
            for key, table in [('handovers','handovers'), ('help','help_requests'), ('parts','parts_requests'), ('assignments','assignment_history'), ('logs','repair_logs')]:
                j[key] = self.rows(db, f'SELECT * FROM {table} WHERE job_id=? ORDER BY rowid', (jid,))
            for p in j['parts']:
                p['procurement'] = json.loads(p['procurement'])
                p['history'] = self.rows(db, 'SELECT * FROM parts_followups WHERE parts_request_id=? ORDER BY rowid', (p['id'],))
            # Private conversations are visible only to the participants.
            j['help'] = [h for h in j['help'] if user['id'] in (h['requester_id'], h['helper_id'])] if user['role'] == 'technician' else [{k:v for k,v in h.items() if k != 'problem'} for h in j['help']]
            j['blockers'] = self.blockers(db, j, user)
        return j

    def version(self, db, j, data):
        version = integer(data, 'expectedVersion', 1, 2147483647)
        require(version == j['version'], 'This repair changed. Reload it and review the latest version before saving.', 409)

    def audit(self, db, j, user, action, note=''):
        self.insert(db, 'repair_logs', id=uid(), job_id=j['id'], actor_id=user['id'], action=action, note=note, created_at=now())
        db.execute('UPDATE repair_jobs SET version=version+1,updated_at=? WHERE id=?', (now(), j['id']))

    @staticmethod
    def role(user, *roles):
        require(user['role'] in roles, 'This operation is not available to your role.', 403)

    @staticmethod
    def active(j):
        require(j['status'] not in ('Completed', 'Awaiting Customer Confirmation'), 'This repair is read-only.', 409)

    def technician(self, db, technician_id):
        return self.one(db, "SELECT id FROM users WHERE id=? AND role='technician'", (technician_id,), 'Choose a valid technician.')

    def dispatch(self, method, path, data, user):
        parts = path.strip('/').split('/')
        with self.connect() as db:
            if method != 'GET': db.execute('BEGIN IMMEDIATE')
            if path == '/api/technicians' and method == 'GET':
                return self.rows(db, "SELECT id,display_name,role FROM users WHERE role='technician' ORDER BY display_name")
            if path == '/api/users':
                self.role(user, 'manager')
                if method == 'GET': return self.rows(db, 'SELECT id,display_name,email,role FROM users ORDER BY display_name')
                if method == 'POST': return self.create_user(db, data, text(data, 'role', 20))
            if path == '/api/repairs':
                if method == 'POST':
                    self.role(user, 'customer')
                    preferred = data.get('preferredTechnicianId') or None
                    if preferred: self.technician(db, preferred)
                    rid = data.get('requestKey') or uid()
                    try: require(isinstance(rid,str) and str(uuid.UUID(rid))==rid,'Invalid request key.')
                    except (ValueError,AttributeError): raise ApiError(400,'Invalid request key.')
                    values=dict(customer_id=user['id'],preferred_technician_id=preferred,device=text(data,'device',120),type=text(data,'type',30),category=text(data,'category',80),description=text(data,'description',2000),customer_note=text(data,'note',1000,True))
                    existing=db.execute('SELECT * FROM repair_requests WHERE id=?',(rid,)).fetchone()
                    if existing:
                        require(all(existing[k]==v for k,v in values.items()),'This request key was already used with different details.',409)
                        job=self.one(db,'SELECT id FROM repair_jobs WHERE request_id=?',(rid,))
                        return self.detail(db,self.job(db,job['id'],user),user)
                    jid, at = 'FF-' + secrets.token_hex(6).upper(), now()
                    self.insert(db, 'repair_requests', id=rid, **values, submitted_at=at)
                    self.insert(db, 'repair_jobs', id=jid, request_id=rid, status='To Do', progress=0, version=1, received_at=at, updated_at=at)
                    self.insert(db, 'repair_logs', id=uid(), job_id=jid, actor_id=user['id'], action='Repair requested', note='', created_at=at)
                    return self.detail(db, self.job(db, jid, user), user)
                if method == 'GET':
                    where, args = ('', ()) if user['role'] == 'manager' else ('WHERE r.customer_id=?', (user['id'],)) if user['role'] == 'customer' else ('WHERE j.assigned_technician_id=?', (user['id'],))
                    return self.rows(db, f'SELECT j.*,r.device,r.description,r.customer_id,u.display_name AS customer_name,t.display_name AS technician_name FROM repair_jobs j JOIN repair_requests r ON r.id=j.request_id JOIN users u ON u.id=r.customer_id LEFT JOIN users t ON t.id=j.assigned_technician_id {where} ORDER BY j.updated_at DESC', args)
            if path == '/api/help-requests' and method == 'GET':
                self.role(user, 'technician')
                return self.rows(db, 'SELECT h.*,j.version,r.device FROM help_requests h JOIN repair_jobs j ON j.id=h.job_id JOIN repair_requests r ON r.id=j.request_id WHERE h.requester_id=? OR h.helper_id=? ORDER BY h.created_at DESC', (user['id'], user['id']))
            if len(parts) >= 3 and parts[:2] == ['api','repairs']:
                j = self.job(db, parts[2], user)
                if len(parts) == 3 and method == 'GET': return self.detail(db, j, user)
                if len(parts) != 4: raise ApiError(404, 'Endpoint not found.')
                action = parts[3]
                if method == 'GET' and action == 'blockers':
                    self.role(user, 'manager', 'technician'); return self.blockers(db, j, user)
                require(method == 'POST', 'Method not allowed.', 405)
                self.version(db, j, data)
                if action == 'assignment':
                    self.role(user, 'manager'); self.active(j)
                    technician_id = text(data, 'technicianId', 100); self.technician(db, technician_id)
                    require(technician_id != j['assigned_technician_id'], 'This technician is already assigned.', 409)
                    self.insert(db, 'assignment_history', id=uid(), job_id=j['id'], from_technician_id=j['assigned_technician_id'], to_technician_id=technician_id, actor_id=user['id'], created_at=now())
                    db.execute('UPDATE repair_jobs SET assigned_technician_id=? WHERE id=?', (technician_id, j['id']))
                elif action in ('start','resume','ready-for-confirmation'):
                    self.role(user, 'technician')
                    require(j['assigned_technician_id'] == user['id'], 'Only the assigned technician can perform this operation.', 403)
                    expected = {'start':'To Do','resume':'Waiting','ready-for-confirmation':'In Progress'}[action]
                    require(j['status'] == expected, 'The repair is not in the required state.', 409)
                    blockers = self.blockers(db, j, user); require(not blockers, 'Resolve all blockers before proceeding: ' + '; '.join(blockers), 409)
                    status = 'Awaiting Customer Confirmation' if action == 'ready-for-confirmation' else 'In Progress'
                    db.execute('UPDATE repair_jobs SET status=?,progress=? WHERE id=?', (status, 100 if action == 'ready-for-confirmation' else max(10,j['progress']), j['id']))
                elif action == 'confirm-completion':
                    self.role(user, 'customer')
                    require(j['status'] == 'Awaiting Customer Confirmation', 'The technician must mark this repair ready first.', 409)
                    self.insert(db, 'completion_confirmations', id=uid(), job_id=j['id'], customer_id=user['id'], confirmed_at=now())
                    db.execute("UPDATE repair_jobs SET status='Completed',progress=100 WHERE id=?", (j['id'],))
                elif action == 'handovers':
                    self.role(user, 'technician'); self.active(j)
                    self.insert(db, 'handovers', id=uid(), job_id=j['id'], author_id=user['id'], tests=text(data,'tests'), finding=text(data,'finding'), next_step=text(data,'next'), created_at=now())
                elif action == 'public-updates':
                    self.role(user, 'technician', 'manager'); self.active(j)
                    progress = integer(data, 'progress', 0, 99, j['progress'])
                    self.insert(db, 'public_updates', id=uid(), job_id=j['id'], published_by_id=user['id'], reason=text(data,'reason'), next_action=text(data,'nextAction'), action_required=flag(data,'actionRequired'), status_at_publication=j['status'], published_at=now())
                    db.execute('UPDATE repair_jobs SET progress=? WHERE id=?', (progress,j['id']))
                elif action == 'messages':
                    require(j['status'] != 'Completed', 'Completed repairs are read-only.', 409)
                    self.insert(db, 'customer_messages', id=uid(), job_id=j['id'], author_id=user['id'], body=text(data,'body',2000), created_at=now())
                elif action == 'help-requests':
                    self.role(user,'technician'); self.active(j)
                    helper = text(data,'helperId',100); self.technician(db, helper)
                    require(helper != user['id'], 'Choose another technician.')
                    count = db.execute("SELECT COUNT(*) FROM help_requests WHERE helper_id=? AND status<>'Resolved'", (helper,)).fetchone()[0]
                    require(count < 4, 'This technician already has four open requests.', 409)
                    blocking = flag(data,'blocking',True)
                    self.insert(db,'help_requests',id=uid(),job_id=j['id'],requester_id=user['id'],helper_id=helper,problem=text(data,'problem',500),blocking=blocking,status='Open',created_at=now())
                    if blocking: db.execute("UPDATE repair_jobs SET status='Waiting' WHERE id=?", (j['id'],))
                elif action == 'parts-requests':
                    self.role(user,'technician'); self.active(j)
                    blocking = flag(data,'blocking',True)
                    self.insert(db,'parts_requests',id=uid(),job_id=j['id'],reported_by_id=user['id'],part_description=text(data,'description',500),quantity=integer(data,'quantity',1,1000,1),blocking=blocking,status='Reported',next_action='Manager to review',created_at=now(),updated_at=now())
                    if blocking: db.execute("UPDATE repair_jobs SET status='Waiting' WHERE id=?", (j['id'],))
                elif action == 'approval-requests':
                    self.role(user,'manager'); self.active(j)
                    if j['current_approval_request_id']:
                        old = self.one(db,'SELECT * FROM approval_requests WHERE id=?',(j['current_approval_request_id'],))
                        require(old['status'] != 'approved', 'Approved work cannot be silently replaced. Withdraw it with a reason first.',409)
                        if old['status'] not in ('withdrawn','superseded'):
                            db.execute("UPDATE approval_requests SET status='superseded',closed_at=? WHERE id=?",(now(),old['id']))
                    aid=uid()
                    self.insert(db,'approval_requests',id=aid,job_id=j['id'],requested_by_id=user['id'],reason=text(data,'reason'),description=text(data,'description'),additional_cost=money(data,'additionalCost'),revised_total=money(data,'revisedTotal',True),currency='AUD',alternative=text(data,'alternative',1000,True),status='pending',created_at=now())
                    db.execute("UPDATE repair_jobs SET current_approval_request_id=?,status='Waiting' WHERE id=?", (aid,j['id']))
                elif action == 'attachments':
                    require(j['status'] != 'Completed', 'Completed repairs are read-only.',409)
                    visibility = 'public' if user['role']=='customer' else text(data,'visibility',20)
                    require(visibility in ('public','internal'),'Invalid visibility.')
                    count=db.execute('SELECT COUNT(*) FROM attachments WHERE job_id=?',(j['id'],)).fetchone()[0]
                    require(count<10,'A repair can contain up to ten attachments.',409)
                    try: content=base64.b64decode(text(data,'content',7_000_000),validate=True)
                    except ValueError: raise ApiError(400,'Invalid image encoding.')
                    require(0<len(content)<=5*1024*1024,'Images must be at most 5 MB.')
                    mime = 'image/png' if content.startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg' if content.startswith(b'\xff\xd8\xff') else 'image/webp' if content[:4]==b'RIFF' and content[8:12]==b'WEBP' else None
                    require(mime is not None,'Upload a PNG, JPEG or WebP image.')
                    self.insert(db,'attachments',id=uid(),job_id=j['id'],uploaded_by_id=user['id'],visibility=visibility,filename=Path(text(data,'filename',120)).name,mime=mime,content=content,created_at=now())
                else: raise ApiError(404,'Endpoint not found.')
                self.audit(db,j,user,action)
                return self.detail(db,self.job(db,j['id'],user),user)
            if len(parts) in (3,4) and parts[:2] == ['api','help-requests']:
                self.role(user,'technician')
                h=self.one(db,'SELECT * FROM help_requests WHERE id=?',(parts[2],))
                require(user['id'] in (h['requester_id'],h['helper_id']),'Help request not found.',404)
                j=self.one(db,'SELECT * FROM repair_jobs WHERE id=?',(h['job_id'],))
                if method=='GET' and len(parts)==3:
                    h['comments']=self.rows(db,'SELECT * FROM help_comments WHERE help_request_id=? ORDER BY rowid',(h['id'],))
                    h['version']=j['version'];return h
                require(method=='POST' and len(parts)==4,'Method not allowed.',405)
                self.version(db,j,data); action=parts[3]
                if action=='appreciation':
                    require(user['id']==h['requester_id'] and not h['appreciated'],'Only the requester can send appreciation once.',409)
                    db.execute('UPDATE help_requests SET appreciated=1 WHERE id=?',(h['id'],))
                else:
                    self.active(j);require(h['status']!='Resolved','This help request is resolved.',409)
                    if action=='accept':
                        require(user['id']==h['helper_id'] and h['status']=='Open','Only the recipient can accept an open request.',403)
                        db.execute("UPDATE help_requests SET status='Accepted',accepted_at=? WHERE id=?",(now(),h['id']))
                    elif action=='comments':
                        require(user['id']==h['requester_id'] or h['status']=='Accepted','Accept this request before replying.',409)
                        self.insert(db,'help_comments',id=uid(),help_request_id=h['id'],author_id=user['id'],body=text(data,'body'),created_at=now())
                    elif action=='resolve':
                        require(user['id']==h['requester_id'],'Only the requester can resolve this request.',403)
                        db.execute("UPDATE help_requests SET status='Resolved',resolved_at=? WHERE id=?",(now(),h['id']))
                    else: raise ApiError(404,'Endpoint not found.')
                self.audit(db,j,user,'help-'+action)
                return {'id':h['id'],'version':j['version']+1}
            if len(parts)==4 and parts[:2]==['api','approval-requests'] and method=='POST':
                p=self.one(db,'SELECT * FROM approval_requests WHERE id=?',(parts[2],))
                j=self.job(db,p['job_id'],user);self.version(db,j,data);self.active(j)
                require(j['current_approval_request_id']==p['id'],'This proposal has been replaced.',409)
                if parts[3]=='response':
                    self.role(user,'customer');require(p['status']=='pending','This proposal has already been answered or withdrawn.',409)
                    decision=text(data,'decision',30);require(decision in ('approved','declined','clarification'),'Choose a valid response.')
                    note=text(data,'note',1000,decision!='clarification') if decision=='clarification' else ''
                    self.insert(db,'approval_responses',id=uid(),approval_request_id=p['id'],customer_id=user['id'],decision=decision,note=note,responded_at=now())
                    db.execute('UPDATE approval_requests SET status=?,closed_at=? WHERE id=?',(decision,now(),p['id']))
                elif parts[3]=='withdraw':
                    self.role(user,'manager');require(p['status'] not in ('withdrawn','superseded'),'This proposal is already closed.',409)
                    db.execute("UPDATE approval_requests SET status='withdrawn',withdrawal_reason=?,closed_at=? WHERE id=?",(text(data,'reason'),now(),p['id']))
                else: raise ApiError(404,'Endpoint not found.')
                self.audit(db,j,user,'approval-'+parts[3]);return self.detail(db,self.job(db,j['id'],user),user)
            if len(parts)==3 and parts[:2]==['api','parts-requests'] and method=='PATCH':
                self.role(user,'manager')
                p=self.one(db,'SELECT * FROM parts_requests WHERE id=?',(parts[2],));j=self.job(db,p['job_id'],user)
                self.version(db,j,data);self.active(j)
                status=text(data,'status',30);require(status in ('Reported','Awaiting approval','Ordered','Received'),'Invalid parts status.')
                owner=data.get('ownerId') or user['id'];self.one(db,"SELECT id FROM users WHERE id=? AND role IN ('manager','technician')",(owner,),'Choose a staff owner.')
                eta=text(data,'expectedArrival',10,True) or None
                if eta:
                    try: datetime.strptime(eta,'%Y-%m-%d')
                    except ValueError: raise ApiError(400,'Use YYYY-MM-DD for expected arrival.')
                procurement=data.get('procurement',{})
                require(isinstance(procurement,dict),'Invalid procurement record.')
                permitted=('stockCheck','stockNote','supplierName','email','website','subject','body','orderReference')
                require(all(k in permitted for k in procurement),'Unknown procurement field.')
                procurement={k:text(procurement,k,2000,True) for k in permitted}
                require(procurement['stockCheck'] in ('','unchecked','available','unavailable'),'Invalid stock check.')
                require(not procurement['website'] or procurement['website'].startswith('https://'),'Use an HTTPS supplier website.')
                if status=='Ordered': require(bool(procurement['orderReference']),'Record an external order reference before marking Ordered.')
                snapshot=dict(p);snapshot['procurement']=json.loads(snapshot['procurement'])
                self.insert(db,'parts_followups',id=uid(),parts_request_id=p['id'],actor_id=user['id'],snapshot=json.dumps(snapshot),created_at=now())
                db.execute('UPDATE parts_requests SET owner_id=?,status=?,next_action=?,expected_arrival=?,procurement=?,updated_at=? WHERE id=?',(owner,status,text(data,'nextAction',1000),eta,json.dumps(procurement),now(),p['id']))
                self.audit(db,j,user,'parts-followup');return self.detail(db,self.job(db,j['id'],user),user)
            raise ApiError(404,'Endpoint not found.')

    def attachment(self, aid, user):
        with self.connect() as db:
            a=self.one(db,'SELECT * FROM attachments WHERE id=?',(aid,))
            self.job(db,a['job_id'],user)
            require(user['role']!='customer' or a['visibility']=='public','Attachment not found.',404)
            return a
