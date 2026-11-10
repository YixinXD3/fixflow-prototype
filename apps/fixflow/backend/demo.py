"""Fictional classroom fixtures, created through the same business operations as the API.

Never import these records as participant evidence. No fixed password or real contact
information is part of this module. Existing repairs are never reset or overwritten.
"""
import uuid

SCENARIOS = {
    'new': ('[DEMO] Phone - awaiting assignment', 'To Do'),
    'active': ('[DEMO] Tablet - diagnostic handover', 'In Progress'),
    'blocked': ('[DEMO] Phone - three independent blockers', 'Waiting'),
    'ready': ('[DEMO] Laptop - customer confirmation', 'Awaiting Customer Confirmation'),
    'completed': ('[DEMO] Console - completed repair', 'Completed'),
    'revised': ('[DEMO] Phone - revised customer proposal', 'Waiting'),
    'reassigned': ('[DEMO] Tablet - reassigned with history', 'In Progress'),
    'advice': ('[DEMO] Laptop - nonblocking technical advice', 'In Progress'),
}


def request_key(key):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'https://fixflow.invalid/synthetic/v1/' + key))


def seed_scenarios(service):
    """Seed only a clean demo database; a complete previous seed is a no-op.

    A partial seed is refused rather than trying to repair/reset a user's records.
    Use a fresh database path if a previous initialization was interrupted.
    """
    with service.connect() as db:
        rows=service.rows(db,'SELECT id,email,display_name,role FROM users')
        users={u['email'].split('@')[0]:u for u in rows if u['email'].endswith('@example.test')}
        required={'manager':'manager','alex':'customer','sam':'customer','jordan':'technician','taylor':'technician','marcus':'technician'}
        if len(rows)!=6 or any(users.get(k,{}).get('role')!=v for k,v in required.items()):
            raise RuntimeError('Synthetic fixtures require the six local demo accounts in a dedicated database.')
        existing=service.rows(db,'SELECT r.id,j.id AS job_id FROM repair_requests r JOIN repair_jobs j ON j.request_id=r.id')
        expected={request_key(k) for k in SCENARIOS}
        if expected.issubset({r['id'] for r in existing}):
            return {k:next(r['job_id'] for r in existing if r['id']==request_key(k)) for k in SCENARIOS}
        if existing:
            raise RuntimeError('Existing/partial repair data retained. Choose a fresh database path for the complete synthetic scenario set.')
    result={}
    def call(method,path,data=None,actor='manager'):
        return service.dispatch(method,path,data or {},users[actor])
    for key,(device,_) in SCENARIOS.items():
        customer='sam' if key in ('ready','advice') else 'alex'
        job=call('POST','/api/repairs',{'requestKey':request_key(key),'device':device,'type':'PC' if 'Laptop' in device else 'Tablet' if 'Tablet' in device else 'Other' if 'Console' in device else 'Phone','category':'Synthetic classroom repair','description':'Fictional demonstration record. No real customer, research observation or repair outcome.','note':'Use this record for classroom walkthroughs only.','preferredTechnicianId':users['taylor']['id'] if key=='new' else ''},customer)
        result[key]=job['id'];path='/api/repairs/'+job['id']
        def act(action,data=None,actor='manager'):
            nonlocal job
            version=call('GET',path)['version']
            job=call('POST',path+'/'+action,{'expectedVersion':version,**(data or {})},actor)
            return job
        if key=='new':continue
        technician='taylor' if key=='advice' else 'jordan'
        act('assignment',{'technicianId':users[technician]['id']})
        act('start',actor=technician)
        act('handovers',{'tests':'Checked power and connectors using fictional diagnostics.','finding':'Demonstration fault reproduced; no real device was tested.','next':'Review this handover and follow the scenario next steps.'},technician)
        act('public-updates',{'reason':'The demonstration repair is being checked.','nextAction':'The repair team will publish the next result.','progress':35},technician)
        if key=='active':
            act('messages',{'body':'Fictional customer note: please retain my device data.'},customer)
            image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvWQAAAAASUVORK5CYII='
            act('attachments',{'filename':'synthetic-pixel.png','content':image,'visibility':'public'},customer)
        elif key=='blocked':
            act('help-requests',{'helperId':users['taylor']['id'],'problem':'Fictional diagnostic question: inspect the display connector.','blocking':True},technician)
            help_id=job['help'][0]['id']
            version=call('GET',path)['version']
            call('POST','/api/help-requests/'+help_id+'/accept',{'expectedVersion':version},'taylor')
            call('POST','/api/help-requests/'+help_id+'/comments',{'expectedVersion':call('GET',path)['version'],'body':'Fictional advice: reseat the connector and repeat the display check.'},'taylor')
            act('parts-requests',{'description':'Fictional replacement display','quantity':1,'blocking':True},technician)
            part_id=job['parts'][0]['id']
            call('PATCH','/api/parts-requests/'+part_id,{'expectedVersion':job['version'],'status':'Ordered','nextAction':'Record receipt after the simulated delivery.','procurement':{'stockCheck':'unavailable','supplierName':'Fictional Parts Supplier','email':'parts@example.test','website':'https://example.test','subject':'DEMO ONLY - no order sent','body':'Fictional procurement draft for classroom display.','orderReference':'SYNTHETIC-ORDER-001'}})
            act('approval-requests',{'reason':'Fictional display replacement','description':'Replace the demonstration display module.','additionalCost':'85.00'})
        elif key in ('ready','completed'):
            act('ready-for-confirmation',actor=technician)
            if key=='completed':act('confirm-completion',actor=customer)
        elif key=='revised':
            act('approval-requests',{'reason':'Fictional first estimate','description':'Replace the demonstration module.','additionalCost':'90.00'})
            aid=job['current_approval_request_id']
            call('POST','/api/approval-requests/'+aid+'/response',{'expectedVersion':job['version'],'decision':'declined'},customer)
            act('approval-requests',{'reason':'Fictional lower-cost alternative','description':'Use a demonstration alternative module.','additionalCost':'60.00','alternative':'Customer can decline; no actual charge is made.'})
        elif key=='reassigned':act('assignment',{'technicianId':users['taylor']['id']})
        elif key=='advice':act('help-requests',{'helperId':users['marcus']['id'],'problem':'Fictional advice-only request: review the diagnostic plan.','blocking':False},technician)
    return result
