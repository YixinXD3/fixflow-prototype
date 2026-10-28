'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const publicDirectory = path.resolve(
  __dirname,
  '..'
);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

async function startServer() {
  const server = http.createServer(async (request, response) => {
    try {
      let pathname = decodeURIComponent(
        new URL(request.url, 'http://localhost').pathname
      );

      if (pathname.endsWith('/')) {
        pathname += 'index.html';
      }

      const filename = path.resolve(
        publicDirectory,
        '.' + pathname
      );

      if (!filename.startsWith(publicDirectory + path.sep)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      const body = await fs.readFile(filename);

      response.writeHead(200, {
        'Content-Type':
          mimeTypes[path.extname(filename)] ||
          'application/octet-stream',
        'Cache-Control': 'no-store'
      });

      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  return {
    server,
    baseURL: `http://127.0.0.1:${server.address().port}/`
  };
}

async function chooseRole(page, baseURL, role) {
  await page.goto(baseURL + '#login');

  await page.locator(
    `[data-customer-action="login"][data-role="${role}"]`
  ).click();

  await page.waitForURL(
    role === 'customer'
      ? '**/#customer-home'
      : '**/#dashboard'
  );
}

async function openRequest(page, baseURL, device) {
  await page.goto(baseURL + '#customer-request');

  await page.getByLabel(
    'Device model',
    { exact: true }
  ).fill(device);

  await page.getByLabel(
    'Problem description',
    { exact: true }
  ).fill('The display is cracked and touch input sometimes fails.');

  await page.getByRole('button', {
    name: 'Select Technician →',
    exact: true
  }).click();

  await page.waitForURL('**/#customer-technicians');
}

async function submitRequest(
  page,
  baseURL,
  device,
  preference = ''
) {
  await openRequest(page, baseURL, device);

  if (preference) {
    await page.locator(
      `[data-customer-action="select-tech"][data-id="${preference}"]`
    ).click();
  }

  await page.getByRole('button', {
    name: 'Submit Repair Request',
    exact: true
  }).click();

  await page.waitForURL('**/#customer-progress/*');

  return page.evaluate(() => route().id);
}

async function readStoredRepairs(page) {
  return page.evaluate(() =>
    JSON.parse(
      sessionStorage.getItem('fixflow-customer-v1') || '[]'
    )
  );
}

test(
  'FixFlow customer workflow',
  { timeout: 240000 },
  async t => {
    const { server, baseURL } = await startServer();
    let browser;

    try {
      // Uses an existing Microsoft Edge installation.
      // Set FIXFLOW_BROWSER=chromium to use Playwright Chromium instead.
      browser = await chromium.launch({
        headless: true,
        ...(process.env.FIXFLOW_BROWSER === 'chromium'
          ? {}
          : { channel: 'msedge' })
      });

      async function scenario(name, run) {
        await t.test(
          name,
          { timeout: 30000 },
          async () => {
            // Each scenario has its own browser storage and fictional data.
            const context = await browser.newContext({
              viewport: {
                width: 390,
                height: 900
              }
            });

            const page = await context.newPage();
            page.setDefaultTimeout(8000);

            const browserErrors = [];
            const failedResources = [];

            page.on('pageerror', error => {
              browserErrors.push(error.message);
            });

            page.on('response', response => {
              if (
                response.url().startsWith(baseURL) &&
                response.status() >= 400
              ) {
                failedResources.push(
                  `${response.status()} ${response.url()}`
                );
              }
            });

            try {
              await run(page);

              assert.deepEqual(
                browserErrors,
                [],
                'The checked journey should have no uncaught JavaScript errors.'
              );

              assert.deepEqual(
                failedResources,
                [],
                'The checked journey should load its local files successfully.'
              );
            } finally {
              await context.close();
            }
          }
        );
      }

      await scenario(
        'C01 — customer entry and mobile layout load',
        async page => {
          await page.goto(baseURL + '#login');

          await page.getByRole('heading', {
            name: 'Welcome to FixFlow',
            exact: true
          }).waitFor();

          await chooseRole(page, baseURL, 'customer');

          await page.getByRole('heading', {
            name: 'Hi, Alex',
            exact: true
          }).waitFor();

          const fitsViewport = await page.evaluate(() =>
            document.documentElement.scrollWidth <=
            window.innerWidth
          );

          assert.equal(
            fitsViewport,
            true,
            'The customer home should not overflow horizontally.'
          );
        }
      );

      await scenario(
        'C02 — whitespace-only requests are rejected',
        async page => {
          await chooseRole(page, baseURL, 'customer');

          const before = await page.evaluate(() => jobs.length);

          await page.goto(baseURL + '#customer-request');

          await page.getByLabel(
            'Device model',
            { exact: true }
          ).fill('   ');

          await page.getByLabel(
            'Problem description',
            { exact: true }
          ).fill('   ');

          await page.getByRole('button', {
            name: 'Select Technician →',
            exact: true
          }).click();

          assert.equal(
            new URL(page.url()).hash,
            '#customer-request'
          );

          assert.equal(
            await page.evaluate(() => jobs.length),
            before,
            'Invalid input must not create a job.'
          );
        }
      );

      await scenario(
        'C03 — request, linked record, list and refresh work',
        async page => {
          await chooseRole(page, baseURL, 'customer');

          const device = 'Customer Test Phone A';

          const id = await submitRequest(
            page,
            baseURL,
            device
          );

          const jobRecord = await page.evaluate(
            repairId => jobs.find(j => j.id === repairId),
            id
          );

          const records = await readStoredRepairs(page);
          const repairRecord = records.find(r => r.id === id);

          assert.ok(jobRecord);
          assert.ok(repairRecord);
          assert.equal(repairRecord.jobId, jobRecord.id);
          assert.equal(repairRecord.customerId, 'C001');
          assert.equal(jobRecord.status, 'To Do');
          assert.equal(jobRecord.assignedTechnicianId, null);

          assert.equal(
            await page.locator('.customer-main .badge').innerText(),
            'Request Submitted'
          );

          await page.reload();

          await page.getByRole('heading', {
            name: device,
            exact: true
          }).waitFor();

          await page.goto(baseURL + '#customer-repairs');

          await page.getByRole('heading', {
            name: device,
            exact: true
          }).waitFor();

          await page.locator(
            `[data-page="customer-progress"][data-id="${id}"]`
          ).click();

          await page.waitForURL(
            '**/#customer-progress/' + id
          );
        }
      );

      await scenario(
        'C04 — preference does not assign work or create duplicates',
        async page => {
          await chooseRole(page, baseURL, 'customer');

          const device = 'Customer Preference Test';

          await openRequest(page, baseURL, device);

          await page.locator(
            '[data-customer-action="select-tech"][data-id="jordan"]'
          ).click();

          // Dispatch two clicks in the same event-loop turn.
          await page.locator(
            '[data-customer-action="submit-repair"]'
          ).evaluate(button => {
            button.click();
            button.click();
          });

          await page.waitForURL('**/#customer-progress/*');

          const created = await page.evaluate(
            name => jobs.filter(j => j.device === name),
            device
          );

          assert.equal(
            created.length,
            1,
            'Repeated submission must create only one job.'
          );

          assert.equal(
            created[0].preferredTechnicianId,
            'jordan'
          );

          assert.equal(
            created[0].assignedTechnicianId,
            null,
            'Preference must not be treated as confirmed assignment.'
          );

          assert.equal(
            await page.locator('.customer-main .badge').innerText(),
            'Request Submitted'
          );
        }
      );

      await scenario(
        'C05 — public update and customer reply use the same repair',
        async page => {
          await chooseRole(page, baseURL, 'customer');

          const id = await submitRequest(
            page,
            baseURL,
            'Customer Publication Test'
          );

          // Manager assignment is now a real prerequisite, not inferred from a preference.
          await page.goto(baseURL + '#login');
          await page.locator('[data-customer-action="login"][data-role="manager"]').click();
          await page.locator(`[data-manager-job="${id}"]`).click();
          await page.locator('[data-manager-form="assign"] select').selectOption('jordan');
          await page.getByRole('button', {name:'Save assignment',exact:true}).click();
          await chooseRole(page, baseURL, 'technician');
          await page.goto(baseURL + '#job/' + id);

          await page.getByRole('button', {
            name: 'Start Repair',
            exact: true
          }).click();

          await page.getByRole('button', {
            name: 'Publish Customer Update',
            exact: true
          }).click();

          await page.locator(
            '#customer-public-form [name="reason"]'
          ).fill('We need a replacement display and technical advice.');

          await page.locator(
            '#customer-public-form [name="nextAction"]'
          ).fill('Please ask about the proposed work before deciding.');

          await page.getByLabel(
            'Replacement part',
            { exact: true }
          ).check();

          await page.getByLabel(
            'Technical support',
            { exact: true }
          ).check();

          await page.getByLabel(
            'Customer response required',
            { exact: true }
          ).check();

          await page.getByRole('button', {
            name: 'Publish Update',
            exact: true
          }).click();

          const publishedAt = await page.evaluate(
            repairId =>
              jobs.find(j => j.id === repairId)
                .publicProgress.publishedAt,
            id
          );

          await chooseRole(page, baseURL, 'customer');
          await page.goto(baseURL + '#customer-progress/' + id);

          assert.equal(
            await page.locator('.customer-main .badge').innerText(),
            'Awaiting Your Response'
          );

          assert.match(
            await page.locator('.customer-fields').innerText(),
            /Replacement part · Technical support/
          );

          await page.getByRole('button', {
            name: 'Open repair conversation',
            exact: true
          }).click();

          await page.getByLabel(
            'Message',
            { exact: true }
          ).fill('Please explain the revised price before I decide.');

          await page.getByRole('button', {
            name: 'Send Message',
            exact: true
          }).click();

          await page.getByRole('button', {
            name: '← Back to Repair Progress',
            exact: true
          }).click();

          await page.getByRole('heading', {
            name: 'Your reply has been sent',
            exact: true
          }).waitFor();

          assert.equal(
            await page.locator('.customer-main .badge').innerText(),
            'Waiting for Shop Reply'
          );

          const currentJob = await page.evaluate(
            repairId => jobs.find(j => j.id === repairId),
            id
          );

          assert.equal(
            currentJob.status,
            'In Progress',
            'A message must not complete or approve the repair.'
          );

          assert.equal(
            currentJob.publicProgress.publishedAt,
            publishedAt,
            'A customer message must not change the public publication time.'
          );

          await page.reload();

          await page.getByRole('heading', {
            name: 'Your reply has been sent',
            exact: true
          }).waitFor();
        }
      );

      await scenario(
        'C06 — old replies, stale updates and final states are handled',
        async page => {
          await chooseRole(page, baseURL, 'customer');

          const id = await submitRequest(
            page,
            baseURL,
            'Customer State Test'
          );

          // Controlled fixture: an older message and a newer publication.
          await page.evaluate(repairId => {
            const j = jobs.find(item => item.id === repairId);
            j.status = 'In Progress';
            j.publicProgress = {
              reason: 'CURRENT PUBLIC EXPLANATION',
              nextAction: 'Please respond to the new proposal.',
              actionRequired: true,
              waitingFor: [],
              statusAtPublication: 'In Progress',
              publishedAt: new Date().toISOString()
            };

            saveSession();

            const records = JSON.parse(
              sessionStorage.getItem('fixflow-customer-v1')
            );

            records.find(r => r.id === repairId).messages.push({
              author: 'customer',
              text: 'This is an older reply.',
              time: '2020-01-01T00:00:00.000Z'
            });

            sessionStorage.setItem(
              'fixflow-customer-v1',
              JSON.stringify(records)
            );
          }, id);

          await page.reload();

          assert.equal(
            await page.locator('.customer-main .badge').innerText(),
            'Awaiting Your Response'
          );

          await page.evaluate(repairId => {
            jobs.find(j => j.id === repairId).status = 'Waiting';
            saveSession();
            render();
          }, id);

          assert.doesNotMatch(
            await page.locator('.customer-main').innerText(),
            /CURRENT PUBLIC EXPLANATION/,
            'A previous-stage publication must not remain current.'
          );

          await page.evaluate(repairId => {
            const j = jobs.find(item => item.id === repairId);
            j.status = 'Completed';
            j.publicProgress.statusAtPublication = 'Completed';
            j.publicProgress.actionRequired = true;
            saveSession();
            render();
          }, id);

          assert.equal(
            await page.locator('.customer-main .badge').innerText(),
            'Completed'
          );

          assert.equal(
            await page.getByRole('button', {
              name: 'Open repair conversation',
              exact: true
            }).count(),
            0
          );
        }
      );

      await scenario(
        'C07 — another customer is excluded and missing routes recover',
        async page => {
          await chooseRole(page, baseURL, 'customer');

          await submitRequest(
            page,
            baseURL,
            'Customer Filter Test'
          );

          await page.evaluate(() => {
            const records = JSON.parse(
              sessionStorage.getItem('fixflow-customer-v1')
            );

            records.push({
              ...records[0],
              id: 'C002-PRIVATE-REPAIR',
              jobId: 'C002-PRIVATE-JOB',
              customerId: 'C002',
              device: 'OTHER CUSTOMER DEVICE'
            });

            sessionStorage.setItem(
              'fixflow-customer-v1',
              JSON.stringify(records)
            );
          });

          await page.reload();

          for (const routeName of [
            'customer-home',
            'customer-repairs',
            'customer-messages'
          ]) {
            await page.goto(baseURL + '#' + routeName);

            assert.doesNotMatch(
              await page.locator('.customer-main').innerText(),
              /OTHER CUSTOMER DEVICE/
            );
          }

          for (const routeName of [
            'customer-progress',
            'customer-messages'
          ]) {
            await page.goto(
              baseURL + '#' + routeName + '/C002-PRIVATE-REPAIR'
            );

            await page.getByRole('heading', {
              name: 'Repair not found',
              exact: true
            }).waitFor();
          }

          await page.goto(
            baseURL + '#customer-progress/DOES-NOT-EXIST'
          );

          await page.getByRole('heading', {
            name: 'Repair not found',
            exact: true
          }).waitFor();

          await page.getByRole('button', {
            name: '← Back to My Repairs',
            exact: true
          }).click();

          await page.waitForURL('**/#customer-repairs');
        }
      );

      await scenario(
        'C08 — failed saving preserves the draft and allows retry',
        async page => {
          await chooseRole(page, baseURL, 'customer');

          await openRequest(
            page,
            baseURL,
            'Customer Storage Test'
          );

          const before = await page.evaluate(() => ({
            count: jobs.length,
            storedJobs: sessionStorage.getItem('fixflow-prototype-v1')
          }));

          // Fail only the customer-record write in this isolated test tab.
          await page.evaluate(() => {
            window.customerTestOriginalSetItem =
              Storage.prototype.setItem;

            Storage.prototype.setItem = function (key, value) {
              if (key === 'fixflow-customer-v1') {
                throw new DOMException(
                  'Simulated storage limit',
                  'QuotaExceededError'
                );
              }

              return window.customerTestOriginalSetItem.call(
                this,
                key,
                value
              );
            };
          });

          try {
            await page.getByRole('button', {
              name: 'Submit Repair Request',
              exact: true
            }).click();

            assert.equal(
              await page.evaluate(() => jobs.length),
              before.count
            );

            assert.equal(
              await page.evaluate(() =>
                sessionStorage.getItem('fixflow-prototype-v1')
              ),
              before.storedJobs,
              'The first stored collection should be restored.'
            );

            assert.match(
              await page.locator('.customer-main').innerText(),
              /Customer Storage Test/,
              'The entered request should remain available.'
            );

            assert.equal(
              new URL(page.url()).hash,
              '#customer-technicians'
            );
          } finally {
            await page.evaluate(() => {
              Storage.prototype.setItem =
                window.customerTestOriginalSetItem;

              delete window.customerTestOriginalSetItem;
            });
          }

          await page.getByRole('button', {
            name: 'Submit Repair Request',
            exact: true
          }).click();

          await page.waitForURL('**/#customer-progress/*');

          await page.getByRole('heading', {
            name: 'Customer Storage Test',
            exact: true
          }).waitFor();
        }
      );

      await scenario(
        'C09 — actual assignment and optional action controls display',
        async page => {
          await chooseRole(page, baseURL, 'customer');

          const id = await submitRequest(
            page,
            baseURL,
            'Customer Integration Test',
            'jordan'
          );

          // Controlled assignment fixture, not a manager UI test.
          await page.evaluate(repairId => {
            const j = jobs.find(item => item.id === repairId);
            j.assignedTechnicianId = 'taylor';
            j.assignedTechnician = 'Taylor Kim';
            saveSession();
            render();
          }, id);

          await page.getByText(
            'Taylor Kim',
            { exact: true }
          ).waitFor();

          assert.equal(
            await page.locator('.customer-main .badge').innerText(),
            'Accepted'
          );

          // Controlled provider fixture, not a formal approval transaction.
          await page.evaluate(repairId => {
            const j = jobs.find(item => item.id === repairId);

            j.status = 'In Progress';
            j.publicProgress = {
              reason: 'Please review the proposal.',
              nextAction: 'Choose an available response.',
              actionRequired: true,
              waitingFor: ['customer'],
              statusAtPublication: 'In Progress',
              publishedAt: new Date().toISOString()
            };

            window.FixFlowCustomerActions = {
              renderProgressActions() {
                const button = document.createElement('button');
                button.textContent = 'Test response control';

                button.addEventListener('click', () => {
                  window.customerTestControlClicked = true;
                });

                return button;
              }
            };

            render();
          }, id);

          await page.getByRole('button', {
            name: 'Test response control',
            exact: true
          }).click();

          assert.equal(
            await page.evaluate(() =>
              window.customerTestControlClicked
            ),
            true,
            'The response control should retain its own event listener.'
          );

          const fitsViewport = await page.evaluate(() =>
            document.documentElement.scrollWidth <=
            window.innerWidth
          );

          assert.equal(fitsViewport, true);
        }
      );
    } finally {
      try {
        if (browser) {
          await browser.close();
        }
      } finally {
        await new Promise(resolve => server.close(resolve));
      }
    }
  }
);
