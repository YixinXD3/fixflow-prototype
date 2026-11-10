"""Synthetic data checks are software verification, never participant evidence."""
import json
import tempfile
import unittest
from pathlib import Path
from backend.demo import SCENARIOS, seed_scenarios
from backend.service import ApiError, Service


class DemoScenarioTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.db=Path(self.tmp.name)/'synthetic.sqlite3'
        self.s=Service(self.db)
        self.s.bootstrap('manager@example.test','Synthetic-test-password-2026',True)
        with self.s.connect() as db:
            self.users={u['email'].split('@')[0]:dict(u) for u in db.execute('SELECT id,email,display_name,role FROM users')}
        self.ids=seed_scenarios(self.s)

    def call(self,method,path,data=None,actor='manager'):
        return self.s.dispatch(method,path,data or {},self.users[actor])

    def test_seed_states_authors_attachments_and_idempotent_restart(self):
        for key,(_,state) in SCENARIOS.items():
            j=self.call('GET','/api/repairs/'+self.ids[key]);self.assertEqual(j['status'],state)
            self.assertTrue(j['device'].startswith('[DEMO]'))
        reassigned=self.call('GET','/api/repairs/'+self.ids['reassigned'],actor='taylor')
        self.assertEqual(reassigned['handovers'][0]['author_id'],self.users['jordan']['id'])
        active=self.call('GET','/api/repairs/'+self.ids['active'],actor='alex')
        self.assertEqual(len(active['attachments']),1);self.assertNotIn('handovers',active)
        revised=self.call('GET','/api/repairs/'+self.ids['revised'],actor='alex')
        self.assertEqual(revised['approvals'][0]['response']['decision'],'declined')
        before=json.dumps(self.call('GET','/api/repairs'))
        self.assertEqual(seed_scenarios(Service(self.db)),self.ids)
        self.assertEqual(before,json.dumps(self.call('GET','/api/repairs')))

    def test_three_blockers_to_customer_confirmation_using_seeded_records(self):
        path='/api/repairs/'+self.ids['blocked']
        def detail(actor='manager'):return self.call('GET',path,actor=actor)
        def change(url,data=None,actor='manager',method='POST'):
            return self.call(method,url,{'expectedVersion':detail()['version'],**(data or {})},actor)
        j=detail();self.assertEqual(len(j['blockers']),3)
        change('/api/help-requests/'+j['help'][0]['id']+'/resolve',actor='jordan')
        self.assertEqual(len(detail()['blockers']),2)
        change('/api/approval-requests/'+j['current_approval_request_id']+'/response',{'decision':'approved'},'alex')
        self.assertEqual(len(detail()['blockers']),1)
        with self.assertRaises(ApiError):change(path+'/resume',actor='jordan')
        change('/api/parts-requests/'+j['parts'][0]['id'],{'status':'Received','nextAction':'Fit and inspect the fictional part.','procurement':j['parts'][0]['procurement']},method='PATCH')
        self.assertEqual(detail()['status'],'Waiting');self.assertEqual(detail()['blockers'],[])
        change(path+'/resume',actor='jordan');change(path+'/ready-for-confirmation',actor='jordan')
        self.assertEqual(detail()['status'],'Awaiting Customer Confirmation')
        change(path+'/confirm-completion',actor='alex')
        restored=Service(self.db).dispatch('GET',path,{},self.users['alex'])
        self.assertEqual(restored['status'],'Completed');self.assertIsNotNone(restored['completion'])
        self.assertNotIn('parts',restored);self.assertNotIn('help',restored)

    def test_seed_does_not_reset_a_user_changed_record(self):
        path='/api/repairs/'+self.ids['ready'];j=self.call('GET',path,actor='sam')
        self.call('POST',path+'/confirm-completion',{'expectedVersion':j['version']},'sam')
        seed_scenarios(self.s)
        self.assertEqual(self.call('GET',path,actor='sam')['status'],'Completed')

    def test_seed_refuses_non_demo_accounts_and_partial_dataset(self):
        other=Service(Path(self.tmp.name)/'other.sqlite3')
        other.bootstrap('operator@example.test','Synthetic-test-password-2026',False)
        with self.assertRaises(RuntimeError):seed_scenarios(other)
        with other.connect() as db:self.assertEqual(db.execute('SELECT count(*) FROM repair_jobs').fetchone()[0],0)
        partial=Service(Path(self.tmp.name)/'partial.sqlite3')
        partial.bootstrap('manager@example.test','Synthetic-test-password-2026',True)
        with partial.connect() as db:customer=dict(db.execute("SELECT id,role FROM users WHERE email='alex@example.test'").fetchone())
        partial.dispatch('POST','/api/repairs',{'device':'Existing user record','type':'Phone','category':'Other','description':'Do not overwrite'},customer)
        with self.assertRaises(RuntimeError):seed_scenarios(partial)
        with partial.connect() as db:self.assertEqual(db.execute('SELECT count(*) FROM repair_jobs').fetchone()[0],1)
