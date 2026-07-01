/* ===================== DEFAULTS ===================== */
const DEFAULTS = {
  username: "Mail",
  password: "csulb1949",
  adminPassword: "Csulb1949",
  templates: {
    package: {
      subject: "Package Ready for Pickup — {{full}}",
      body:
`Hi {{first}},

We've received a package for you{{from_vendor}}. Please make arrangements to collect it at your earliest convenience.
{{tracking}}
You may pick it up at Mail Services, or contact your department's office coordinator to make alternate arrangements.

If you have any questions, please contact Mail Services.

Thank you,
CSULB Mail Services`
    },
    letter: {
      subject: "Mail Waiting for Pickup — {{full}}",
      body:
`Hi {{first}},

You have mail waiting for pickup at Mail Services{{from_vendor}}. Please stop by at your convenience to collect it.

You may pick it up at Mail Services, or contact your department's office coordinator to make alternate arrangements.

Thank you,
CSULB Mail Services`
    },
    pallet: {
      subject: "Pallet/Freight Delivery — Action Required ({{vendor}})",
      body:
`Hi {{first}},

We've received your order from {{vendor}}, however, due to the {{reason}} of the item(s), we are unable to deliver them through our standard delivery service.
You have the following options:

- Place a work order with Beach Building Services (BBS)
- Make alternative arrangements within your department to pick up the item
For assistance, BBS Customer Service can be reached at 562-985-4357 or BeachBuildingServices@csulb.edu
A photo of the item is attached for your reference.
Please let us know how you'd like to proceed. We appreciate your understanding

Thank you,
CSULB Mail Services`
    }
  }
};

/* ===================== SETTINGS STORAGE ===================== */
function getSettings(){
  try{
    const raw = localStorage.getItem('mailtool:settings');
    if(raw){
      const parsed = JSON.parse(raw);
      // merge with defaults so new template keys aren't lost on upgrade
      return {
        username: parsed.username ?? DEFAULTS.username,
        password: parsed.password ?? DEFAULTS.password,
        adminPassword: parsed.adminPassword ?? DEFAULTS.adminPassword,
        templates: {
          package: parsed.templates?.package ?? DEFAULTS.templates.package,
          letter: parsed.templates?.letter ?? DEFAULTS.templates.letter,
          pallet: parsed.templates?.pallet ?? DEFAULTS.templates.pallet,
        }
      };
    }
  }catch(e){}
  return JSON.parse(JSON.stringify(DEFAULTS));
}
function saveSettings(s){
  localStorage.setItem('mailtool:settings', JSON.stringify(s));
}

let SETTINGS = getSettings();

/* ===================== LOGIN ===================== */
const loginScreen = document.getElementById('loginScreen');
const appRoot = document.getElementById('appRoot');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');
const loginErr = document.getElementById('loginErr');

function tryLogin(){
  const u = loginUser.value.trim();
  const p = loginPass.value;
  if(u === SETTINGS.username && p === SETTINGS.password){
    sessionStorage.setItem('mailtool:loggedIn', '1');
    showApp();
  } else {
    loginErr.style.display = 'block';
  }
}
document.getElementById('loginBtn').addEventListener('click', tryLogin);
loginPass.addEventListener('keydown', e => { if(e.key === 'Enter') tryLogin(); });
loginUser.addEventListener('keydown', e => { if(e.key === 'Enter') tryLogin(); });

function showApp(){
  loginScreen.classList.add('hidden');
  appRoot.classList.remove('hidden');
  loadDirectoryIfNeeded();
}
document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('mailtool:loggedIn');
  location.reload();
});

if(sessionStorage.getItem('mailtool:loggedIn') === '1'){
  showApp();
}

/* ===================== TABS ===================== */
document.querySelectorAll('nav.tabs button[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button[data-tab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-build').classList.add('hidden');
    document.getElementById('tab-guide').classList.add('hidden');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
  });
});

/* ===================== DIRECTORY (lazy fetch) ===================== */
let DIRECTORY = [];
let directoryLoaded = false;
function loadDirectoryIfNeeded(){
  if(directoryLoaded) return;
  fetch('directory.json').then(r => r.json()).then(data => {
    DIRECTORY = data;
    directoryLoaded = true;
  }).catch(() => {
    console.warn('Could not load directory.json — name lookup will be manual only. (This file must be served over http(s), not opened directly as a local file.)');
  });
}

/* ===================== STEP 1: DELIVERY TYPE ===================== */
let currentType = null;
const typeCards = document.querySelectorAll('.typecard');
typeCards.forEach(card => {
  card.addEventListener('click', () => {
    typeCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    currentType = card.dataset.type;
    document.getElementById('cardRecipient').classList.remove('hidden');
    document.querySelectorAll('.tpl-fields').forEach(f => f.classList.add('hidden'));
    document.getElementById('fields' + capitalize(currentType)).classList.remove('hidden');
    document.getElementById('cardDetails').classList.remove('hidden');
  });
});
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

/* ===================== STEP 2: RECIPIENT SEARCH ===================== */
const recipSearch = document.getElementById('recipSearch');
const recipResults = document.getElementById('recipResults');
const recipSelected = document.getElementById('recipSelected');
const recipEmailHint = document.getElementById('recipEmailHint');
const recipEmailManual = document.getElementById('recipEmailManual');
const lblManualEmail = document.getElementById('lblManualEmail');

let currentRecipient = null; // {name, email, dept, title}

recipSearch.addEventListener('input', () => {
  const q = recipSearch.value.trim().toLowerCase();
  currentRecipient = null;
  if(q.length < 2){ recipResults.classList.remove('show'); recipResults.innerHTML=''; return; }
  if(!directoryLoaded){
    recipResults.innerHTML = '<div class="result-item">Loading directory… try again in a moment, or type the email manually below.</div>';
    recipResults.classList.add('show');
    showManualEmail(true);
    return;
  }
  const matches = DIRECTORY.filter(p => p.n.toLowerCase().includes(q)).slice(0, 30);
  if(matches.length === 0){
    recipResults.innerHTML = '<div class="result-item">No matches — type the email manually below.</div>';
    showManualEmail(true);
  } else {
    recipResults.innerHTML = matches.map((p,i) =>
      `<div class="result-item" data-idx="${DIRECTORY.indexOf(p)}">
        <div class="dn">${escapeHtml(p.n)}</div>
        <div class="meta">${escapeHtml(p.e)}${p.d ? ' · ' + escapeHtml(p.d) : ''}</div>
      </div>`
    ).join('');
  }
  recipResults.classList.add('show');
});

recipResults.addEventListener('click', e => {
  const item = e.target.closest('.result-item');
  if(!item || !item.dataset.idx) return;
  selectRecipient(DIRECTORY[parseInt(item.dataset.idx)]);
});

function selectRecipient(p){
  currentRecipient = { name: p.n, email: p.e, dept: p.d, title: p.t };
  recipSearch.value = p.n;
  recipResults.classList.remove('show');
  recipSelected.innerHTML = `
    <div class="row"><span class="lbl">Name:</span><b>${escapeHtml(p.n)}</b></div>
    <div class="row"><span class="lbl">Email:</span>${escapeHtml(p.e)}</div>
    ${p.d ? `<div class="row"><span class="lbl">Department:</span>${escapeHtml(p.d)}</div>` : ''}
  `;
  recipSelected.classList.add('show');
  showManualEmail(false);
  // Try to prefill department search with their dept text
  if(p.d){
    document.getElementById('cardDept').classList.remove('hidden');
  }
}

function showManualEmail(show){
  lblManualEmail.style.display = show ? 'block' : 'none';
  recipEmailManual.style.display = show ? 'block' : 'none';
  if(show){
    recipSelected.classList.remove('show');
    document.getElementById('cardDept').classList.remove('hidden');
  }
}
recipEmailManual.addEventListener('input', () => {
  currentRecipient = {
    name: recipSearch.value.trim() || 'there',
    email: recipEmailManual.value.trim(),
    dept: '', title: ''
  };
});

document.addEventListener('click', e => {
  if(!e.target.closest('#recipSearch') && !e.target.closest('#recipResults')){
    recipResults.classList.remove('show');
  }
  if(!e.target.closest('#deptSearch') && !e.target.closest('#deptResults')){
    deptResults.classList.remove('show');
  }
});

/* ===================== STEP 3: DEPARTMENT / ASM SEARCH ===================== */
const deptSearch = document.getElementById('deptSearch');
const deptResults = document.getElementById('deptResults');
const deptSelected = document.getElementById('deptSelected');
const coordFields = document.getElementById('coordFields');
const coordName = document.getElementById('coordName');
const coordEmail = document.getElementById('coordEmail');

let currentDept = null;

function deptStorageKey(d){ return 'asmcoord:' + d.tax + ':' + d.deptid; }
function loadCoord(d){
  try{ const raw = localStorage.getItem(deptStorageKey(d)); if(raw) return JSON.parse(raw); }catch(e){}
  return {name:'', email:''};
}
function saveCoord(d, name, email){
  try{ localStorage.setItem(deptStorageKey(d), JSON.stringify({name,email})); }catch(e){}
}

deptSearch.addEventListener('input', () => {
  const q = deptSearch.value.trim().toLowerCase();
  if(q.length < 2){ deptResults.classList.remove('show'); deptResults.innerHTML=''; return; }
  const matches = ASM_DATA.filter(d =>
    d.descr.toLowerCase().includes(q) || d.deptid.toLowerCase().includes(q) ||
    d.tax.toLowerCase().includes(q) || d.asm.toLowerCase().includes(q)
  ).slice(0, 40);
  deptResults.innerHTML = matches.length === 0
    ? '<div class="result-item">No matches</div>'
    : matches.map(d => `
        <div class="result-item" data-idx="${ASM_DATA.indexOf(d)}">
          <div class="dn">${escapeHtml(d.descr)}</div>
          <div class="meta">${escapeHtml(d.tax)} · Dept ${escapeHtml(d.deptid)} · ${escapeHtml(d.loc)} · ASM: ${escapeHtml(d.asm)}</div>
        </div>`).join('');
  deptResults.classList.add('show');
});

deptResults.addEventListener('click', e => {
  const item = e.target.closest('.result-item');
  if(!item || !item.dataset.idx) return;
  selectDept(ASM_DATA[parseInt(item.dataset.idx)]);
});

function selectDept(d){
  currentDept = d;
  deptSearch.value = d.descr;
  deptResults.classList.remove('show');
  deptSelected.innerHTML = `
    <div class="row"><span class="lbl">Department:</span><b>${escapeHtml(d.descr)}</b></div>
    <div class="row"><span class="lbl">Dept ID:</span>${escapeHtml(d.tax)} / ${escapeHtml(d.deptid)} (${escapeHtml(d.loc)})</div>
    <div class="row"><span class="lbl">ASM:</span>${escapeHtml(d.asm)} — ${escapeHtml(d.asmEmail || 'no email on file')}</div>
  `;
  deptSelected.classList.add('show');
  coordFields.classList.remove('hidden');
  const saved = loadCoord(d);
  coordName.value = saved.name || '';
  coordEmail.value = saved.email || '';
}

[coordName, coordEmail].forEach(el => {
  el.addEventListener('change', () => { if(currentDept) saveCoord(currentDept, coordName.value.trim(), coordEmail.value.trim()); });
});

/* ===================== STEP 4 + GENERATE ===================== */
document.getElementById('generateBtn').addEventListener('click', generateEmail);

function generateEmail(){
  if(!currentType){ alert('Please choose a delivery type.'); return; }
  if(!currentRecipient || !currentRecipient.email){ alert('Please select or enter a recipient email.'); return; }

  let vendor='', tracking='', reasonParts=[];
  if(currentType === 'package'){
    vendor = document.getElementById('pkgVendor').value.trim();
    const trk = document.getElementById('pkgTracking').value.trim();
    tracking = trk ? `Package info: ${trk}` : '';
  } else if(currentType === 'letter'){
    vendor = document.getElementById('ltrVendor').value.trim();
  } else if(currentType === 'pallet'){
    vendor = document.getElementById('palVendor').value.trim();
    if(!vendor){ alert('Please enter the vendor for a pallet/freight delivery.'); return; }
    if(document.getElementById('reasonSize').checked) reasonParts.push('size');
    if(document.getElementById('reasonWeight').checked) reasonParts.push('weight');
    if(document.getElementById('reasonBulky').checked) reasonParts.push('bulky nature');
    if(reasonParts.length === 0){ alert('Please check at least one reason (size, weight, or bulky nature).'); return; }
  }

  const first = (currentRecipient.name || 'there').split(' ')[0];
  const full = currentRecipient.name || '';
  const fromVendor = vendor ? ` from ${vendor}` : '';
  const reason = reasonParts.join(', ').replace(/, ([^,]*)$/, ' and $1');

  const tpl = SETTINGS.templates[currentType];
  const tokens = {
    '{{first}}': first,
    '{{full}}': full,
    '{{vendor}}': vendor,
    '{{tracking}}': tracking,
    '{{reason}}': reason,
    '{{from_vendor}}': fromVendor,
  };
  let subject = tpl.subject, body = tpl.body;
  for(const [k,v] of Object.entries(tokens)){
    subject = subject.split(k).join(v);
    body = body.split(k).join(v);
  }
  // clean up stray blank lines left by empty tracking token etc.
  body = body.replace(/\n[ \t]*\n[ \t]*\n/g, '\n\n').replace(/\n[ \t]+\n/g, '\n\n');

  const ccList = [];
  if(currentDept){
    if(currentDept.asmEmail) ccList.push(currentDept.asmEmail);
    if(coordEmail.value.trim()) ccList.push(coordEmail.value.trim());
  }
  const cc = ccList.join('; ');
  const to = currentRecipient.email;

  const preview = document.getElementById('preview');
  preview.innerHTML =
    `<div class="pf"><b>To:</b> ${escapeHtml(to)}</div>` +
    (cc ? `<div class="pf"><b>Cc:</b> ${escapeHtml(cc)}</div>` : '') +
    `<div class="pf"><b>Subject:</b> ${escapeHtml(subject)}</div><br>` +
    escapeHtml(body);

  document.getElementById('cardPreview').classList.remove('hidden');
  document.getElementById('cardPreview').scrollIntoView({behavior:'smooth', block:'start'});

  const mailto = `mailto:${encodeURIComponent(to)}` +
    (cc ? `?cc=${encodeURIComponent(cc)}&` : '?') +
    `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.getElementById('outlookLink').href = mailto;

  document.getElementById('copyBtn').onclick = () => {
    navigator.clipboard.writeText(body).then(() => {
      const m = document.getElementById('copiedMsg');
      m.style.display = 'inline';
      setTimeout(() => m.style.display = 'none', 1500);
    });
  };
}

document.getElementById('startOverBtn').addEventListener('click', () => location.reload());

/* ===================== HELPERS ===================== */
function escapeHtml(s){
  return (s || '').toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* ===================== ADMIN PANEL ===================== */
const gearBtn = document.getElementById('gearBtn');
const adminLoginModal = document.getElementById('adminLoginModal');
const adminPanel = document.getElementById('adminPanel');
const adminPassInput = document.getElementById('adminPassInput');
const adminErr = document.getElementById('adminErr');

gearBtn.addEventListener('click', () => {
  adminPassInput.value = '';
  adminErr.style.display = 'none';
  adminLoginModal.classList.remove('hidden');
  adminPassInput.focus();
});
document.getElementById('adminCancelBtn').addEventListener('click', () => adminLoginModal.classList.add('hidden'));
document.getElementById('adminLoginBtn').addEventListener('click', () => {
  if(adminPassInput.value === SETTINGS.adminPassword){
    adminLoginModal.classList.add('hidden');
    openAdminPanel();
  } else {
    adminErr.style.display = 'block';
  }
});
adminPassInput.addEventListener('keydown', e => { if(e.key === 'Enter') document.getElementById('adminLoginBtn').click(); });

function openAdminPanel(){
  document.getElementById('setUsername').value = SETTINGS.username;
  document.getElementById('setPassword').value = SETTINGS.password;
  document.getElementById('setAdminPass').value = SETTINGS.adminPassword;
  document.getElementById('tplPackageSubject').value = SETTINGS.templates.package.subject;
  document.getElementById('tplPackageBody').value = SETTINGS.templates.package.body;
  document.getElementById('tplLetterSubject').value = SETTINGS.templates.letter.subject;
  document.getElementById('tplLetterBody').value = SETTINGS.templates.letter.body;
  document.getElementById('tplPalletSubject').value = SETTINGS.templates.pallet.subject;
  document.getElementById('tplPalletBody').value = SETTINGS.templates.pallet.body;
  adminPanel.classList.remove('hidden');
}
document.getElementById('closeAdminBtn').addEventListener('click', () => adminPanel.classList.add('hidden'));

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  SETTINGS.username = document.getElementById('setUsername').value.trim() || DEFAULTS.username;
  SETTINGS.password = document.getElementById('setPassword').value || DEFAULTS.password;
  SETTINGS.adminPassword = document.getElementById('setAdminPass').value || DEFAULTS.adminPassword;
  SETTINGS.templates.package.subject = document.getElementById('tplPackageSubject').value;
  SETTINGS.templates.package.body = document.getElementById('tplPackageBody').value;
  SETTINGS.templates.letter.subject = document.getElementById('tplLetterSubject').value;
  SETTINGS.templates.letter.body = document.getElementById('tplLetterBody').value;
  SETTINGS.templates.pallet.subject = document.getElementById('tplPalletSubject').value;
  SETTINGS.templates.pallet.body = document.getElementById('tplPalletBody').value;
  saveSettings(SETTINGS);
  alert('Settings saved.');
  adminPanel.classList.add('hidden');
});

document.getElementById('resetDefaultsBtn').addEventListener('click', () => {
  if(!confirm('Reset all email templates to default text? This will not change your username/password.')) return;
  SETTINGS.templates = JSON.parse(JSON.stringify(DEFAULTS.templates));
  saveSettings(SETTINGS);
  openAdminPanel();
});
