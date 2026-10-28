'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const publicRoot = path.resolve(__dirname, '..');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

let server;
let browser;
let baseUrl;

function serve(request, response) {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'customer-approval-demo.html' : pathname.slice(1);
  const filename = path.resolve(publicRoot, relative);

  if (!filename.startsWith(publicRoot + path.sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filename, (error, content) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filename)] || 'application/octet-stream'
    });
    response.end(content);
  });
}

async function customerPage(viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('fixflow-browser-test-ready') !== 'yes') {
      sessionStorage.clear();
      sessionStorage.setItem('fixflow-browser-test-ready', 'yes');
      sessionStorage.setItem('fixflow-role', 'customer');
    }
  });
  await page.goto(`${baseUrl}/customer-approval-demo.html#customer-progress/CR-1001`);
  await page.getByRole('heading', { name: 'Approve additional repair work' }).waitFor();
  return { context, errors, page };
}

async function savedJob(page, id = 'RS-10482') {
  return page.evaluate(jobId => {
    const stored = JSON.parse(sessionStorage.getItem('fixflow-prototype-v1'));
    return stored.jobs.find(job => job.id === jobId);
  }, id);
}

before(async () => {
  server = http.createServer(serve);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});

after(async () => {
  await browser?.close();
  await new Promise(resolve => server?.close(resolve));
});

test('mobile approval page loads without runtime errors or horizontal overflow', async () => {
  const { context, errors, page } = await customerPage();

  assert.equal(await page.getByText('$129.00').isVisible(), true);
  assert.equal(await page.getByText('$258.00').isVisible(), true);
  assert.equal(await page.getByText(/Compatible display option/).isVisible(), true);
  assert.equal(await page.getByText('Jordan Smith · Repair technician').isVisible(), true);
  assert.equal(await page.getByRole('button', { name: 'Approve' }).isVisible(), true);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true
  );
  assert.deepEqual(errors, []);

  await context.close();
});

test('main index loads the Week 13 customer action integration', async () => {
  const { context, errors, page } = await customerPage();

  await page.goto(`${baseUrl}/index.html#customer-progress/CR-1001`);
  await page.getByRole('heading', { name: 'Approve additional repair work' }).waitFor();

  assert.equal(
    await page.evaluate(() => typeof window.FixFlowCustomerActions?.renderProgressActions),
    'function'
  );
  assert.equal(await page.getByRole('button', { name: 'Approve' }).isVisible(), true);
  assert.deepEqual(errors, []);

  await context.close();
});

test('keyboard approval persists once and remains separate from completion', async () => {
  const { context, errors, page } = await customerPage();
  const approve = page.getByRole('button', { name: 'Approve' });

  await approve.focus();
  await page.keyboard.press('Enter');

  const job = await savedJob(page);
  const request = job.approvalRequests.find(item => item.id === job.currentApprovalRequestId);
  assert.equal(request.response.kind, 'approved');
  assert.equal(job.status, 'In Progress');
  assert.equal(job.logs.some(log => /approved/i.test(log.title)), true);

  await page.reload();
  assert.equal(
    await page.getByRole('heading', { name: 'Your approval has been recorded' }).isVisible(),
    true
  );
  assert.deepEqual(errors, []);

  await context.close();
});

test('decline persists without approving or completing the repair', async () => {
  const { context, errors, page } = await customerPage();
  await page.getByRole('button', { name: 'Decline' }).click();

  const job = await savedJob(page);
  const request = job.approvalRequests.find(item => item.id === job.currentApprovalRequestId);
  assert.equal(request.response.kind, 'declined');
  assert.equal(job.status, 'In Progress');
  assert.deepEqual(errors, []);

  await context.close();
});

test('clarification requires and preserves customer text', async () => {
  const { context, errors, page } = await customerPage();
  await page.getByRole('button', { name: 'Need clarification' }).click();
  const field = page.getByRole('textbox', { name: 'Clarification request' });
  assert.equal(await field.isVisible(), true);

  await page.getByRole('button', { name: 'Send clarification request' }).click();
  assert.equal(await page.getByText('Enter the clarification you need.').isVisible(), true);

  await field.fill('Does the quoted cost include the functional test?');
  await page.getByRole('button', { name: 'Send clarification request' }).click();

  const job = await savedJob(page);
  const request = job.approvalRequests.find(item => item.id === job.currentApprovalRequestId);
  assert.equal(request.response.kind, 'clarification');
  assert.equal(request.response.note, 'Does the quoted cost include the functional test?');
  assert.deepEqual(errors, []);

  await context.close();
});

test('completion confirmation changes only an awaiting repair to Completed', async () => {
  const { context, errors, page } = await customerPage();

  await page.evaluate(() => {
    const stored = JSON.parse(sessionStorage.getItem('fixflow-prototype-v1'));
    const job = stored.jobs.find(item => item.id === 'RS-10482');
    job.status = 'Awaiting Customer Confirmation';
    job.progress = 100;
    job.publicProgress = {
      reason: 'The replacement display passed the final functional test.',
      nextAction: 'Confirm the repair result.',
      actionRequired: false,
      waitingFor: ['customer'],
      statusAtPublication: 'Awaiting Customer Confirmation',
      publishedAt: new Date().toISOString()
    };
    sessionStorage.setItem('fixflow-prototype-v1', JSON.stringify(stored));
  });
  await page.reload();

  await page.getByRole('heading', { name: 'Confirm the repair result' }).waitFor();
  await page.getByRole('button', { name: 'Confirm repair completion' }).click();

  const job = await savedJob(page);
  assert.equal(job.status, 'Completed');
  assert.equal(job.logs.some(log => /confirmed/i.test(log.title)), true);
  assert.deepEqual(errors, []);

  await context.close();
});
