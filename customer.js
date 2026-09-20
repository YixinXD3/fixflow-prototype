'use strict';
// Customer views use an explicit public projection; internal notes/logs never render here.
const customerAccount = { name: 'Alex Chen', email: 'alex.chen@example.com' };
const customerTechnicians = [
  { id: 'jordan', name: 'Jordan Smith', specialty: 'Phone & Tablet Repair', manager: 'Sarah Lee', available: true },
  { id: 'taylor', name: 'Taylor Kim', specialty: 'Phone & Display Repair', manager: 'Sarah Lee', available: true },
  { id: 'marcus', name: 'Marcus Lee', specialty: 'Computers & Appliances', manager: 'David Wong', available: true }
];
let activeRole = null;
try { const role = sessionStorage.getItem('fixflow-role'); if (['technician', 'customer'].includes(role)) activeRole = role; } catch {}
let customerRepairs = [{ id: 'CR-1001', jobId: 'RS-10482', device: 'iPhone 13', type: 'Phone', category: 'Screen Repair', description: 'Screen cracked and touch unresponsive.', note: '', techId: 'jordan', submitted: '2025-04-28T10:24:00', photos: [], messages: [{ author: 'technician', text: 'Your iPhone has been checked in. I will update your progress when the repair starts.', time: '2025-04-28T10:30:00' }] }];
try { const stored = JSON.parse(sessionStorage.getItem('fixflow-customer-v1') || 'null'); if (Array.isArray(stored)) customerRepairs = stored; } catch {}
const newCustomerDraft = () => ({ type: 'Phone', device: '', category: 'Screen Repair', description: '', note: '', techId: '', photos: [] });
let customerDraft = newCustomerDraft();
const customerMessageDrafts = {};
function saveCustomerData() { try { sessionStorage.setItem('fixflow-customer-v1', JSON.stringify(customerRepairs)); } catch { toast('Browser storage is full. Changes are kept in memory until you reload.'); } }
function customerDate(value) { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function customerTech(r) { return customerTechnicians.find(t => t.id === r.techId); }
function customerStatus(r) {
  const j = jobs.find(j => j.id === r.jobId);
  if (!j || j.status === 'To Do') return r.id === 'CR-1001' ? 'Accepted' : 'Request Submitted';
  if (j.status === 'Awaiting Customer Confirmation') return 'Ready for Pickup';
  if (j.status === 'Waiting') return j.shortages.some(s => !s.fulfilled) ? 'Waiting for Part' : 'Waiting for Update';
  return j.status;
}
function customerUpdate(r) {
  const status = customerStatus(r);
  return ({ 'Request Submitted': 'Your request has been sent to your selected technician.', Accepted: 'Your repair has been accepted and is waiting to start.', 'In Progress': 'Your technician is working on your device.', 'Waiting for Part': 'Your repair is delayed while a replacement part is arranged.', 'Waiting for Update': 'Your technician has paused the repair. Message them for an update.', 'Ready for Pickup': 'Your device is ready. Message your technician to arrange pickup.', Completed: 'Your repair is complete. Thank you for choosing FixFlow.' })[status];
}
function roleLogin() {
  return `<main class="main login-main"><div class="login-brand"><img src="assets/favicon.svg" alt="" class="logo"><strong>FixFlow</strong></div><div class="login-intro"><h1>Welcome to FixFlow</h1><p>Choose your role to get started.</p></div><div class="role-options"><button class="role-card" data-customer-action="login" data-role="technician">${tile('tool')}<span><strong>Repair Technician</strong><small>Manage jobs and support your team</small></span><span class="chevron">›</span></button><button class="role-card" data-customer-action="login" data-role="customer">${tile('user')}<span><strong>Customer</strong><small>Request a repair and follow its progress</small></span><span class="chevron">›</span></button></div><p class="prototype-note">Prototype login · No password required</p></main>`;
}
function customerHeader() { return `<header class="header"><img class="logo" src="assets/favicon.svg" alt=""><div class="brand"><strong>FixFlow</strong></div><button class="profile" data-customer-action="nav" data-page="customer-profile" aria-label="Customer profile"><span class="avatar">AC</span></button></header>`; }
function customerNav(active) {
  return `<nav class="bottom-nav customer-nav" aria-label="Customer navigation">${[['customer-home','home','Home'],['customer-repairs','jobs','My Repairs'],['customer-request','plus','Request'],['customer-messages','chat','Messages'],['customer-profile','user','Profile']].map(([page,i,label]) => `<button class="nav-item ${active === page ? 'active' : ''}" ${active === page ? 'aria-current="page"' : ''} data-customer-action="nav" data-page="${page}">${icon(i)}${label}</button>`).join('')}</nav>`;
}
function customerLayout(body, active = 'customer-home') { return `${customerHeader()}<main class="main customer-main">${body}</main>${customerNav(active)}`; }
function customerBack(page, text, id = '') { return `<button class="back" data-customer-action="nav" data-page="${page}" data-id="${id}">${icon('arrow')} ${text}</button>`; }
function customerCard(r) {
  return `<button class="panel customer-repair-card" data-customer-action="nav" data-page="customer-progress" data-id="${r.id}"><div class="customer-card-top">${deviceIcon({type:r.type})}<div class="grow"><h2>${esc(r.device)}</h2><p>${esc(r.category)}</p></div><span class="chevron">›</span></div>${badge(customerStatus(r))}<p>Technician: ${esc(customerTech(r).name)}</p><small>Submitted ${customerDate(r.submitted)}</small><span class="customer-link">View Progress →</span></button>`;
}
function customerHome() {
  const active = customerRepairs.filter(r => customerStatus(r) !== 'Completed');
  return customerLayout(`${pageHeading('Hi, Alex','Let’s get your devices working again.')}<div class="customer-stat">${tile('tool')}<div><strong>${active.length}</strong><span>Active ${active.length === 1 ? 'repair' : 'repairs'}</span></div></div><button class="primary full" data-customer-action="nav" data-page="customer-request">${icon('plus')} Request Repair</button><div class="section-head"><h2>Latest repair</h2><button class="text-button" data-customer-action="nav" data-page="customer-repairs">View all</button></div>${customerRepairs.length ? customerCard(customerRepairs[0]) : empty('No repairs yet','Send your first repair request to get started.')}<div class="customer-note">${icon('chat')}<p>Need an update? Message the technician assigned to your repair.</p></div>`);
}
function customerMyRepairs() { return customerLayout(`${pageHeading('My Repairs','Your requests and their latest progress.')}<div class="customer-stack">${customerRepairs.map(customerCard).join('') || empty('No repairs yet','Request a repair to get started.')}</div>`, 'customer-repairs'); }
function customerOptions(values, selected) { return values.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join(''); }
function customerRequest() {
  const d = customerDraft;
  return customerLayout(`${pageHeading('Request Repair','Step 1 of 2 · Tell us about your device')}<form id="customer-request-form" class="panel customer-form"><label class="field">Device type<select name="type" required>${customerOptions(['Phone','Tablet','PC','Appliance','Other'],d.type)}</select></label><label class="field">Device model<input name="device" required maxlength="80" value="${esc(d.device)}" placeholder="e.g. iPhone 15 Pro"></label><label class="field">Repair issue<select name="category" required>${customerOptions(['Screen Repair','Battery Issue','Charging Issue','Power Issue','Water Damage','Software Issue','Other'],d.category)}</select></label><label class="field">Problem description<textarea name="description" required maxlength="500" placeholder="What happened to your device?">${esc(d.description)}</textarea></label><label class="field">Note <small>Optional</small><textarea name="note" maxlength="300" placeholder="Anything else your technician should know?">${esc(d.note)}</textarea></label><label class="field">Photos <small>Optional · Preview only, no upload</small><input id="customer-photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><div id="customer-photo-preview" class="customer-photos">${customerPhotoPreview()}</div><button class="primary full" type="submit">Select Technician →</button></form>`, 'customer-request');
}
function customerPhotoPreview() { return customerDraft.photos.map((p,i) => `<div class="customer-photo"><img src="${esc(p.src)}" alt="${esc(p.name)}"><button type="button" data-customer-action="remove-photo" data-index="${i}" aria-label="Remove ${esc(p.name)}">×</button></div>`).join(''); }
function customerSelectTechnician() {
  if (!customerDraft.device.trim() || !customerDraft.description.trim()) return customerLayout(`${customerBack('customer-request','Back to Request Repair')}${empty('Tell us about your device first','Complete the repair form before choosing a technician.')}`, 'customer-request');
  const d = customerDraft;
  return customerLayout(`${customerBack('customer-request','Edit repair request')}${pageHeading('Select Technician','Step 2 of 2 · Choose who repairs your device')}<div class="panel customer-review"><strong>${esc(d.device)}</strong><p>${esc(d.category)}</p><p class="muted">${esc(d.description)}</p>${d.note ? `<p>Note: ${esc(d.note)}</p>` : ''}<small>${d.photos.length} photo${d.photos.length === 1 ? '' : 's'} attached</small></div><div class="customer-stack">${customerTechnicians.map(t => `<section class="panel customer-tech ${d.techId === t.id ? 'selected' : ''}"><div class="customer-card-top"><span class="avatar">${esc(initials(t.name))}</span><div><h2>${esc(t.name)}</h2><p>${esc(t.specialty)}</p></div></div><span class="customer-availability">${t.available ? 'Available' : 'Unavailable'}</span><p class="customer-manager">Manager: <strong>${esc(t.manager)}</strong></p><button class="${d.techId === t.id ? 'primary' : 'secondary'} full" data-customer-action="select-tech" data-id="${t.id}" aria-pressed="${d.techId === t.id}" ${t.available ? '' : 'disabled'}>${d.techId === t.id ? 'Selected' : 'Select Technician'}</button></section>`).join('')}</div><button class="primary full" data-customer-action="submit-repair" ${d.techId ? '' : 'disabled'}>Submit Repair Request</button><p class="prototype-note">Demo request · Stored in this browser tab</p>`, 'customer-request');
}
function customerProgress() {
  const r = customerRepairs.find(r => r.id === route().id);
  if (!r) return customerLayout(`${customerBack('customer-repairs','Back to My Repairs')}${empty('Repair not found','Choose one of your repairs to see its progress.')}`, 'customer-repairs');
  const status = customerStatus(r), t = customerTech(r);
  const stages = ['Request Submitted','Accepted','In Progress'];
  if (status === 'Waiting for Part' || status === 'Waiting for Update') stages.push(status);
  stages.push('Ready for Pickup','Completed');
  const current = stages.indexOf(status);
  return customerLayout(`${customerBack('customer-repairs','Back to My Repairs')}${pageHeading('Repair Progress','#' + r.id)}<section class="panel customer-review"><h2>${esc(r.device)}</h2><p>${esc(r.category)}</p>${badge(status)}<p>${esc(customerUpdate(r))}</p></section><section class="panel customer-review"><h2>Your technician</h2><strong>${esc(t.name)}</strong><p>${esc(t.specialty)}</p><p>Manager: ${esc(t.manager)}</p></section><section class="panel"><h2>Repair timeline</h2><ol class="customer-timeline">${stages.map((s,i) => `<li class="${i < current ? 'done' : i === current ? 'current' : 'pending'}" ${i === current ? 'aria-current="step"' : ''}><span class="stage-dot">${i < current ? icon('check') : i + 1}</span><div><strong>${s}</strong><small>${i < current ? 'Done' : i === current ? 'Current stage' : 'Upcoming'}</small></div></li>`).join('')}</ol><p class="muted">Your technician updates this progress. A parts-wait stage appears only when needed.</p></section><button class="primary full" data-customer-action="nav" data-page="customer-messages" data-id="${r.id}">${icon('chat')} Message Technician</button><p class="prototype-note">Submitted ${customerDate(r.submitted)}</p>`, 'customer-repairs');
}
function customerMessages() {
  const r = customerRepairs.find(r => r.id === route().id);
  if (!r) return customerLayout(`${pageHeading('Messages','Conversations with your assigned technicians.')}<div class="customer-stack">${customerRepairs.map(r => `<button class="panel customer-message-row" data-customer-action="nav" data-page="customer-messages" data-id="${r.id}"><span class="avatar">${esc(initials(customerTech(r).name))}</span><span class="grow"><strong>${esc(customerTech(r).name)}</strong><small>${esc(r.device)} · #${r.id}</small><p>${esc(r.messages.at(-1)?.text || 'Start a conversation about this repair.')}</p></span><span class="chevron">›</span></button>`).join('') || empty('No conversations yet','Submit a repair request to message your technician.')}</div>`, 'customer-messages');
  return customerLayout(`${customerBack('customer-messages','All messages')}${pageHeading(customerTech(r).name,r.device+' · #'+r.id)}<p class="customer-message-hint">Prototype conversation · Messages stay in this browser tab.</p><div class="customer-conversation">${r.messages.map(m => `<article class="customer-message ${m.author === 'customer' ? 'sent' : ''}"><strong>${m.author === 'customer' ? 'You' : esc(customerTech(r).name)}</strong><p>${esc(m.text)}</p><time>${new Date(m.time).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></article>`).join('') || '<p class="muted">Ask your technician about this repair.</p>'}</div><form id="customer-message-form" data-repair-id="${r.id}" class="customer-form"><label class="field">Message<textarea name="message" required maxlength="1000" placeholder="Write to your technician…">${esc(customerMessageDrafts[r.id] || '')}</textarea></label><button class="primary full" type="submit">${icon('send')} Send Message</button></form>`, 'customer-messages');
}
function customerProfile() { return customerLayout(`${pageHeading('Profile','Your customer account')}<section class="panel customer-review"><span class="avatar">AC</span><h2>${customerAccount.name}</h2><p>${customerAccount.email}</p><small>Sample customer profile</small></section><button class="secondary full" data-customer-action="logout">Logout</button><p class="prototype-note">Prototype only · No real authentication.<br>Your demo repairs stay in this tab when you switch roles.</p>`, 'customer-profile'); }
function renderRoleView() {
  const p = route().page;
  if (!activeRole || p === 'login' || !location.hash) {
    if (p !== 'login' || !location.hash) history.replaceState(null,'','#login');
    document.title = 'FixFlow | Select Your Role';
    $('#app').innerHTML = `<div class="shell">${roleLogin()}</div>`; return true;
  }
  if (activeRole === 'customer') {
    const pages = {'customer-home':customerHome,'customer-repairs':customerMyRepairs,'customer-request':customerRequest,'customer-technicians':customerSelectTechnician,'customer-progress':customerProgress,'customer-messages':customerMessages,'customer-profile':customerProfile};
    if (!pages[p]) history.replaceState(null,'','#customer-home');
    $('#app').innerHTML = `<div class="shell">${(pages[p] || customerHome)()}</div>`;
    document.title = 'FixFlow | Customer'; return true;
  }
  if (p.startsWith('customer-')) history.replaceState(null,'','#dashboard');
  return false;
}
function logoutRole() { activeRole = null; customerDraft = newCustomerDraft(); clearTimeout(window.toastTimer); $('#toast').classList.remove('show'); $('#toast').textContent=''; try { sessionStorage.removeItem('fixflow-role'); } catch {} closeSheet(); go('login'); }
function submitCustomerRepair() {
  const d = customerDraft, t = customerTechnicians.find(t => t.id === d.techId && t.available);
  if (!t || !d.device.trim() || !d.description.trim()) return toast('Complete your repair request and select a technician.');
  const id = 'CR-' + crypto.randomUUID().slice(0,8).toUpperCase(), timestamp = new Date().toISOString();
  const r = { ...d, id, jobId: id, device: d.device.trim(), description: d.description.trim(), submitted: timestamp, photos: [...d.photos], messages: [] };
  jobs.unshift({ id, device: r.device, type: d.type === 'Tablet' ? 'Other' : d.type, issue: d.category, priority: 'Medium', status: 'To Do', progress: 0, label: '', customer: customerAccount.name, assignedTechnician: t.name, customerDescription: r.description + (r.note ? '\nNote: ' + r.note : ''), receivedAt: timestamp, updated: now(), notes: '', logs: [{ title: 'Customer repair request submitted', time: now(), note: 'Assigned to ' + t.name }], attachments: [...d.photos], shortages: [] });
  customerRepairs.unshift(r); saveSession(); saveCustomerData(); customerDraft = newCustomerDraft(); go('customer-repairs'); toast('Repair request submitted.');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-customer-action]'); if (!b) return;
  const a = b.dataset.customerAction;
  if (a === 'login') { if (!['customer','technician'].includes(b.dataset.role)) return; activeRole = b.dataset.role; try { sessionStorage.setItem('fixflow-role',activeRole); } catch {} go(activeRole === 'customer' ? 'customer-home' : 'dashboard'); }
  else if (a === 'logout') logoutRole();
  else if (activeRole !== 'customer') return;
  else if (a === 'nav') go(b.dataset.page,b.dataset.id);
  else if (a === 'select-tech') { customerDraft.techId = b.dataset.id; render(); }
  else if (a === 'submit-repair') submitCustomerRepair();
  else if (a === 'remove-photo') { customerDraft.photos.splice(Number(b.dataset.index),1); $('#customer-photo-preview').innerHTML = customerPhotoPreview(); }
});
document.addEventListener('input', e => {
  if (activeRole !== 'customer') return;
  if (e.target.form?.id === 'customer-request-form' && e.target.name) customerDraft[e.target.name] = e.target.value;
  if (e.target.form?.id === 'customer-message-form') customerMessageDrafts[e.target.form.dataset.repairId] = e.target.value;
});
document.addEventListener('change', async e => {
  if (activeRole !== 'customer' || e.target.id !== 'customer-photo-input') return;
  const draft = customerDraft;
  for (const file of e.target.files) {
    if (draft.photos.length >= 3) { toast('Add up to 3 photos.'); break; }
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { toast('Choose JPG, PNG or WebP images under 2 MB.'); continue; }
    try { const src = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); if (draft !== customerDraft || activeRole !== 'customer') return; draft.photos.push({ name: file.name, src }); } catch { toast('Could not read this photo.'); }
  }
  const preview = $('#customer-photo-preview'); if (preview && draft === customerDraft) preview.innerHTML = customerPhotoPreview();
});
document.addEventListener('submit', e => {
  if (activeRole !== 'customer') return;
  const form = e.target;
  if (!['customer-request-form','customer-message-form'].includes(form.id)) return;
  e.preventDefault(); if (!form.reportValidity()) return;
  const fd = new FormData(form);
  if (form.id === 'customer-request-form') { for (const key of ['type','device','category','description','note']) customerDraft[key] = String(fd.get(key) || '').trim(); if (!customerDraft.device || !customerDraft.description) return toast('Enter a device model and problem description.'); go('customer-technicians'); }
  else { const r = customerRepairs.find(r => r.id === form.dataset.repairId), text = String(fd.get('message') || '').trim(); if (!r || !text) return; r.messages.push({author:'customer',text,time:new Date().toISOString()}); delete customerMessageDrafts[r.id]; saveCustomerData(); render(); toast('Message saved in this prototype conversation.'); }
});
