/* Yujie manager integration: pure rules for the existing shared jobs schema. */
(function (root) {
  'use strict';
  const technicians = [{id:'jordan',name:'Jordan Smith'}, {id:'taylor',name:'Taylor Kim'}, {id:'marcus',name:'Marcus Lee'}];
  const statuses = ['Reported', 'Awaiting approval', 'Ordered', 'Received'];
  const final = job => ['Completed', 'Awaiting Customer Confirmation'].includes(job.status);
  const copy = value => JSON.parse(JSON.stringify(value));
  const text = value => String(value ?? '').trim();
  const technician = id => technicians.find(t => t.id === id);
  const assignedId = job => Object.hasOwn(job, 'assignedTechnicianId') ? job.assignedTechnicianId : 'jordan';
  const proposal = job => (job.approvalRequests || []).find(p => p.id === job.currentApprovalRequestId) || null;
  function blockers(job, help = []) {
    const items = (job.shortages || []).filter(s => s.blocking !== false && !(s.fulfilled || s.status === 'Received')).map(s => 'Part: ' + (s.part || s.comment || s.type));
    help.filter(r => r.jobId === job.id && !['Resolved','Completed'].includes(r.status)).forEach(() => items.push('Technical help still open'));
    const p = proposal(job);
    if (p && !['approved','withdrawn','superseded'].includes(p.status)) items.push(p.status === 'pending' ? 'Customer decision pending' : 'Manager follow-up required: ' + p.status);
    return items;
  }
  function workError(job, actor, help = []) {
    if (!job) return 'Repair not found.';
    if (!assignedId(job)) return 'A manager must assign this repair first.';
    if (assignedId(job) !== actor) return 'This repair is assigned to a different technician.';
    if (final(job)) return 'This repair is already awaiting confirmation or completed.';
    const remaining = blockers(job, help);
    return remaining.length ? 'Resolve these before continuing: ' + remaining.join('; ') : '';
  }
  function log(job, title, note, at) {
    job.logs ||= [];
    job.logs.push({title, note, time:at, actor:'Demo manager'});
    job.updatedAt = at;
    job.updated = new Date(at).toLocaleString('en-AU');
  }

  function supplierLinks(record) {
    if (!record || record.stockCheck !== 'unavailable') return {};
    const links = {};
    if (/^[^\s@,;?&#]+@[^\s@,;?&#]+\.[^\s@,;?&#]+$/.test(record.email || '') && !/[\r\n]/.test(record.subject || '')) {
      links.email = 'mailto:' + record.email + '?subject=' + encodeURIComponent(record.subject || '') + '&body=' + encodeURIComponent(record.body || '');
    }
    try { const u = new URL(record.website); if (u.protocol === 'https:' && !u.username && !u.password) links.website = u.href; } catch (_) {}
    return links;
  }
  function operate(original, action, input, at = new Date().toISOString(), id = '') {
    if (!original) return {error:'Repair not found.'};
    if (final(original)) return {error:'Completed repairs and repairs awaiting confirmation are read-only.'};
    const job = copy(original);
    if (action === 'assign') {
      const t = technician(input.technicianId);
      if (!t) return {error:'Choose a valid technician.'};
      if (assignedId(job) === t.id) return {job:original, changed:false};
      const previous = technician(assignedId(job))?.name || 'Unassigned';
      job.assignedTechnicianId = t.id;
      job.assignedTechnician = t.name;
      job.assignmentHistory ||= [];
      job.assignmentHistory.push({from:assignedId(original),to:t.id,actor:'Demo manager',at});
      log(job, 'Technician assigned', previous + ' → ' + t.name, at);
    } else if (action === 'shortage') {
      const s = (job.shortages || []).find(s => s.id === input.shortageId);
      if (!s) return {error:'This parts request is no longer available.'};
      const owner = text(input.owner), nextAction = text(input.nextAction), eta = text(input.expectedArrival);
      if (!['Demo manager', ...technicians.map(t => t.name)].includes(owner)) return {error:'Choose a follow-up owner.'};
      if (!statuses.includes(input.status)) return {error:'Choose a valid parts status.'};
      if (!nextAction || nextAction.length > 240) return {error:'Enter a next action of 1–240 characters.'};
      if (eta && (!/^\d{4}-\d{2}-\d{2}$/.test(eta) || !Number.isFinite(Date.parse(eta)) || new Date(eta).toISOString().slice(0,10) !== eta)) return {error:'Enter a valid date or leave the arrival estimate blank.'};
      const before = s.status || (s.fulfilled ? 'Received' : 'Reported');
      s.history ||= [];
      s.history.push({from:before,to:input.status,owner,nextAction,expectedArrival:eta,at,actor:'Demo manager'});
      Object.assign(s,{owner,status:input.status,nextAction,expectedArrival:eta,fulfilled:input.status === 'Received',updatedAt:at});
      // Reopening a blocking shortage pauses work. Receipt never resumes or completes it.
      if (s.blocking !== false && !s.fulfilled && job.status === 'In Progress') job.status = 'Waiting';
      log(job, 'Parts follow-up updated', (s.part || s.type) + ': ' + before + ' → ' + s.status + '. ' + nextAction, at);
    } else if (action === 'procurement') {
      const shortage = (job.shortages || []).find(s => s.id === input.shortageId);
      if (!shortage) return {error:'This parts request is no longer available.'};
      const stockCheck = text(input.stockCheck), stockNote = text(input.stockNote);
      if (!['unchecked','available','unavailable'].includes(stockCheck)) return {error:'Choose a stock check result.'};
      if (!stockNote || stockNote.length > 500) return {error:'Record the requirement and stock check (up to 500 characters).'};
      const record = {stockCheck,stockNote,supplierName:text(input.supplierName),email:text(input.email),website:text(input.website),partDescription:text(input.partDescription),quantity:Number(input.quantity),subject:text(input.subject),body:text(input.body),orderReference:text(input.orderReference),updatedAt:at};
      if (!record.partDescription || record.partDescription.length > 200 || !Number.isInteger(record.quantity) || record.quantity < 1 || record.quantity > 999) return {error:'Enter the required part and a whole quantity from 1 to 999.'};
      if (record.supplierName.length > 120 || record.email.length > 254 || record.website.length > 1000 || record.subject.length > 200 || record.body.length > 2000 || record.orderReference.length > 120) return {error:'Supplier details or draft exceed the field limits.'};
      const links = supplierLinks({...record,stockCheck:'unavailable'});
      if (record.email && !links.email) return {error:'Enter one valid supplier email address and a single-line subject.'};
      if (record.website && !links.website) return {error:'Use an HTTPS supplier website without embedded login details.'};
      if (stockCheck === 'unavailable' && (!record.supplierName || (!record.email && !record.website))) return {error:'For external procurement, enter a supplier name and email or website.'};
      if (stockCheck === 'unavailable' && record.email && (!record.subject || !record.body)) return {error:'Review and complete the email subject and message.'};
      shortage.procurementHistory ||= [];
      shortage.procurementHistory.push({...copy(record),actor:'Demo manager'});
      shortage.procurement = record;
      log(job,'Requirement and supplier follow-up recorded',(shortage.part || shortage.type) + ': stock ' + stockCheck,at);
      // Checking stock or preparing contact must never imply an order, receipt or repair completion.
    } else if (action === 'propose') {
      const reason = text(input.reason), description = text(input.description), amount = text(input.additionalCost);
      if (!reason || reason.length > 500 || !description || description.length > 1000) return {error:'Enter a reason (up to 500 characters) and proposed work (up to 1000 characters).'};
      if (!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) > 100000) return {error:'Enter an additional cost from 0 to 100000, with at most two decimal places.'};
      if (!id || (job.approvalRequests || []).some(p => p.id === id)) return {error:'A new proposal ID is required.'};
      const old = proposal(job);
      if (old && old.status === 'approved') return {error:'The current work is approved. Withdraw it explicitly before proposing different work.'};
      if (old && !['withdrawn','superseded'].includes(old.status)) { old.previousStatus = old.status; old.status = 'superseded'; old.supersededAt = at; }
      const p = {id,reason,description,additionalCost:Number(amount),currency:'AUD',requestedByName:'Demo manager',requestedByRole:'Manager',createdAt:at,status:'pending',response:null};
      job.approvalRequests ||= [];
      job.approvalRequests.push(p);
      job.currentApprovalRequestId = id;
      job.status = 'Waiting';
      job.publicProgress = {reason, nextAction:'Review the proposed work and additional cost, then choose a response.',waitingFor:['customer'],actionRequired:true,statusAtPublication:job.status,publishedAt:at};
      log(job, old ? 'Revised repair proposal published' : 'Repair proposal published', description + ' · Additional AUD ' + Number(amount).toFixed(2), at);
    } else if (action === 'withdraw') {
      const p = proposal(job), reason = text(input.reason);
      if (!p || ['withdrawn','superseded'].includes(p.status)) return {error:'There is no active proposal to withdraw.'};
      if (!reason || reason.length > 500) return {error:'Enter a withdrawal reason of 1–500 characters.'};
      p.previousStatus = p.status;
      p.status = 'withdrawn'; p.withdrawnAt = at; p.withdrawalReason = reason;
      job.publicProgress = {reason:'The proposed extra work was withdrawn: ' + reason,nextAction:'The repair team will confirm the next step.',waitingFor:[],actionRequired:false,statusAtPublication:job.status,publishedAt:at};
      log(job, 'Extra work withdrawn (not customer approval)', reason, at);
    } else return {error:'Unknown manager action.'};
    return {job,changed:true};
  }
  const api = {supplierLinks,technicians,statuses,assignedId,technician,proposal,blockers,workError,operate,final};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FixFlowManagerModel = api;
})(typeof window === 'undefined' ? globalThis : window);
