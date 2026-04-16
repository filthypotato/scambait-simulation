const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// Whatever the scammer types as their username becomes their display name.
// Split on spaces, dots, underscores, hyphens and capitalize each word.
function getDisplayName(username) {
  if (!username) return 'Valued Customer';
  var parts = username.trim().split(/[\s._-]+/).map(function(p) {
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  });
  return parts.join(' ');
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── TRAP CONFIG (lives in memory, survives until server restart) ──
// All traps ON by default. Admin panel lets you toggle them.
const TRAPS = {
  // ── Time-wasting verification traps ──
  identityVerification: { label: 'Identity Verification Modal',      desc: 'Fires ~4s after login. Fails SSN/DOB 3 times before advancing.', enabled: true },
  securityQuestion:     { label: 'Security Question Challenge',       desc: 'Fires after identity verification. Wrong answer twice.', enabled: true },
  w9Form:               { label: 'W-9 / IRS Form Requirement',        desc: 'Pops up 90s after security question passes. TIN always wrong twice.', enabled: true },
  unusualActivity:      { label: 'Unusual Activity Alert',            desc: 'Fires 3 min after security question. Forces them to "call".', enabled: true },
  sessionReauth:        { label: 'Session Security Recheck',          desc: 'Password re-prompt that is wrong twice. Repeats every 5 min.', enabled: true },
  callbackScheduler:    { label: 'Callback Scheduler',                desc: 'Shows after W-9 failure. Picks a slot 3-5 days out.', enabled: true },
  deviceCodeModal:      { label: 'New Device Verification Code',      desc: 'Device warning bar + 6-digit code modal. Always wrong 3x.', enabled: true },
  wireTransfer:         { label: 'Wire Transfer 72-hr Hold',          desc: 'Wire attempts held for 72-hour "cooling period" twice.', enabled: true },
  transferDelay:        { label: 'Transfer Processing Delay',         desc: '38–60 second fake processing spinner. Fails with error code twice.', enabled: true },
  // ── Chaos / humour traps ──
  aggressiveInterest:   { label: '💰 Aggressive Interest Ticker',    desc: 'Balance visibly increases $1/second with "Interest (Very Aggressive)" label. Gives false hope.', enabled: true },
  scammerTax:           { label: '🧾 Scammer Tax Transaction',       desc: 'After 3 min, injects a -$9,999 debit labeled "Scammer Tax – Ref: IRS-SCAM-2024" into the transaction list.', enabled: true },
  suspiciousYou:        { label: '🚨 Suspicious Activity = You',      desc: 'Notification banner: We detected suspicious activity... its you.', enabled: true },
  scamChat:             { label: '🤖 Sarcastic Support Chatbot',     desc: 'Chat widget that starts professional, becomes aware of scammer, escalates to roasting them.', enabled: true },
  fakeUpdate:           { label: '💻 Fake System Update Screen',     desc: 'Triggered on 4th wire attempt. Full-screen fake Windows Update with anti-scammer messages.', enabled: true },
  niceTryPopup:         { label: '😂 Nice Try Lol Popup',             desc: 'Appears after 5 failed wire attempts instead of the update screen.', enabled: true },
  fbiRedirect:          { label: '🚔 FBI Warning Page Redirect',      desc: 'After 6 wire attempts, redirects to a fake FBI cybercrime warning page.', enabled: true },

  // ── VISUAL CHAOS ──
  cursorDrift:          { label: '🖱️ Cursor Drift',                   desc: 'Mouse cursor slowly drifts away from where they click. Maddening.', enabled: false },
  disappearingButton:   { label: '🏃 Disappearing Transfer Button',   desc: 'Transfer/Submit button jumps to a random corner when hovered.', enabled: false },
  mirrorMode:           { label: '🪞 Mirror Mode',                    desc: 'Flips the entire page horizontally. Text reads backwards.', enabled: false },
  fontWingdings:        { label: '🔤 Wingdings Font Mode',            desc: 'Switches all body text to Wingdings/Symbol font. Unreadable.', enabled: false },
  slowMotion:           { label: '🐌 Slow Motion Mode',               desc: 'All CSS transitions run at 10% speed. Page feels broken.', enabled: false },
  confettiBlock:        { label: '🎉 Confetti Screen Block',          desc: 'Covers screen with confetti that hides content. Festive obstruction.', enabled: false },
  zoomChaos:            { label: '🔍 Random Zoom Chaos',              desc: 'Browser zoom randomly oscillates between 60% and 150%.', enabled: false },
  pageShake:            { label: '📳 Page Earthquake',                desc: 'Entire page vibrates side to side violently.', enabled: false },
  fadeOut:              { label: '👻 Page Fade Out',                  desc: 'Page slowly fades to near-invisible opacity, then back.', enabled: false },
  upsideDown:           { label: '🙃 Upside Down Mode',               desc: 'Rotates the entire page 180 degrees.', enabled: false },
  balanceRandomizer:    { label: '🎲 Balance Randomizer',             desc: 'Account balances randomly change by a few cents every 5 seconds.', enabled: false },
  buttonSwap:           { label: '🔄 Confirm/Cancel Button Swap',     desc: 'Randomly swaps Confirm and Cancel button positions on hover.', enabled: false },
  infiniteScroll:       { label: '♾️ Infinite Transaction History',   desc: 'Injects 500 fake transactions making the list endless to scroll.', enabled: false },
  clickCounter:         { label: '🔢 Clicks Until Unlocked Counter',  desc: 'Shows a counter "48 clicks until account unlocks" that resets at 1.', enabled: false },
  invisibleFields:      { label: '👁️ Invisible Input Fields',         desc: 'Input fields get same text/background color. Looks like typing fails.', enabled: false },

  // ── FAKE ERRORS & SYSTEM MESSAGES ──
  voiceRecRequired:     { label: '🎙️ Voice Recognition Required',     desc: 'Popup asks them to say "I am a real person" into microphone.', enabled: false },
  queueNumber:          { label: '🎫 Too Many Users Queue',           desc: 'Overlay: "Queue position #4,921. Estimated wait: 3 hours."', enabled: false },
  biosShutdown:         { label: '🔋 System Shutdown Countdown',      desc: 'Fake Windows battery/shutdown warning counting down from 60s (loops).', enabled: false },
  javaUpdateLoop:       { label: '☕ Java Update Infinite Loop',      desc: '"Updating Java Security... 99%" progress bar that resets to 0%.', enabled: false },
  ispFirewallBlock:     { label: '🧱 ISP Firewall Block',             desc: '"Your ISP has blocked this transaction due to suspicious foreign activity."', enabled: false },
  biometricFail:        { label: '👁️ Retinal Scan Failed',            desc: '"Retinal scan failed through webcam. Please clean your screen and retry."', enabled: false },
  checksumMismatch:     { label: '#️⃣ Checksum Mismatch Error',        desc: '"Transaction hash mismatch. Please re-enter your 16-digit verification code."', enabled: false },
  hackerTerminal:       { label: '💀 Hacker Terminal Popup',          desc: 'Fake CMD window "deleting system32" visually. Alarming aesthetic.', enabled: false },
  browserIncompat:      { label: '🌐 Browser Incompatibility Error',  desc: '"Browser not supported for transfers. Please install Internet Explorer 6."', enabled: false },
  govAuditFreeze:       { label: '🏛️ IRS Audit Freeze',              desc: '"This account is under active IRS audit. All transactions paused 72hrs."', enabled: false },
  fakeBsod:             { label: '💙 Fake Blue Screen of Death',      desc: 'Full CSS BSOD covering browser. Scary "CRITICAL_SCAMMER_DETECTED" stop code.', enabled: false },
  certExpired:          { label: '🔐 Expired SSL Certificate Warning', desc: 'Big red browser-style "Your connection is not private" fake error page.', enabled: false },
  mouseTrail:           { label: '✨ Mouse Trail Spam',               desc: 'Dozens of coloured dots trail the cursor and fill the screen.', enabled: false },
  typingSlowdown:       { label: '⌨️ Keyboard Input Slowdown',        desc: 'Each keystroke in any field is delayed by 3 seconds.', enabled: false },
  formReset:            { label: '🗑️ Form Auto-Reset',                desc: 'Wire transfer form wipes itself 30 seconds after they start filling it.', enabled: false },
  validationLoop:       { label: '🔁 Validation Contradiction Loop',  desc: '"Zip must match city" then "City must match zip" — impossible to satisfy.', enabled: false },
  fakeDbReindex:        { label: '🗄️ Database Re-Index Delay',        desc: 'Progress bar: "Optimizing account database... 14 hours remaining."', enabled: false },
  withdrawalLimit:      { label: '💸 $1.25/Day Withdrawal Limit',     desc: '"For your security, max withdrawal is $1.25 per day. Reset: midnight."', enabled: false },
  ieRequired:           { label: '🦕 Requires Internet Explorer 11',  desc: 'Page detects non-IE browser and shows a full-screen IE11 download prompt.', enabled: false },

  // ── PSYCHOLOGICAL TRAPS ──
  rivalScammer:         { label: '📞 Rival Scammer On Hold',          desc: 'Notification: "Another support representative is already assisting this account."', enabled: false },
  charityTransfer:      { label: '❤️ Accidental Charity Donation',    desc: '"Transfer successful! $500 donated to Red Cross on your behalf." No real transfer.', enabled: false },
  policeKnock:          { label: '👮 Police Door Knock Audio',         desc: 'Plays loud knock sound + "POLICE OPEN UP" in a notification.', enabled: false },
  wrongNumber:          { label: '📟 Wrong Account Number Notice',     desc: 'After wire: "Funds sent to account ending in 0000 (St. Jude Children\'s Hospital)."', enabled: false },
  accountFrozen:        { label: '🧊 Account Frozen Notice',          desc: '"Your account has been frozen pending identity review. Estimated: 5-10 business days."', enabled: false },
  irsLien:              { label: '📜 IRS Tax Lien Placed',            desc: '"The IRS has placed a lien on this account for $47,293 in unpaid taxes."', enabled: false },
  redemptionPopup:      { label: '😇 Pierogi Redemption Speech',      desc: 'Drops all pretense. Sincere popup explaining this is a honeypot and they should stop.', enabled: false },
  greedyBalance:        { label: '🤑 Hidden Million Found',           desc: 'Alert: "Our system found an unclaimed $1,000,000 balance! Processing... please wait."', enabled: false },
  surveyWall:           { label: '📋 Mandatory Marketing Survey',     desc: '"Please complete our 50-question satisfaction survey to unlock transfers."', enabled: false },
  termsScroll:          { label: '📜 Unending Terms & Conditions',    desc: 'Must scroll a 100-page T&C document to the very bottom before proceeding.', enabled: false },

  // ── UI INTERACTION TRAPS ──
  captchaInfinite:      { label: '🤖 Infinite CAPTCHA',              desc: 'Never-ending CAPTCHA sequence. Every mountain image is a mountain.', enabled: false },
  fakeProgress:         { label: '📊 Backwards Progress Bar',        desc: 'Progress bar randomly jumps backwards. "35%... 42%... 31%... 38%..."', enabled: false },
  redirectLoop:         { label: '🔄 Login Redirect Loop',           desc: 'Login sends them to Step 2, which redirects back to Step 1 indefinitely.', enabled: false },
  addressFail:          { label: '📮 Address Autocorrect Sabotage',   desc: 'City field keeps auto-correcting to fake places like "Old York" or "Fakesville".', enabled: false },
  adOverlay:            { label: '📢 Inappropriate Ad Overlays',      desc: 'Cheesy late-night infomercial style popups appear over the form fields.', enabled: false },
  fakeFbi:              { label: '🚨 Fake FBI IP Logger Banner',      desc: 'Blinking red banner: "WARNING: Your IP [fake IP] is being logged by FBI Cyber."', enabled: false },
  devToolsSpoof:        { label: '🔧 DevTools Override Alert',        desc: 'If they use F12/inspect, shows a fake "Tampering Detected" security alert.', enabled: false },
  brokenKeys:           { label: '⌨️ Broken Number Keys (0 & 5)',     desc: 'The digits 0 and 5 silently fail in amount/account number fields.', enabled: false },
  cursorTeleport:       { label: '🌀 Cursor Teleport on Submit',      desc: 'The moment they click Send, cursor teleports to Log Out button.', enabled: false },
  scrollLock:           { label: '🔒 Page Scroll Lock',              desc: 'Scroll position resets to top of page every 8 seconds.', enabled: false },

  // ── AUDIO / NOTIFICATION TRAPS ──
  alertSpam:            { label: '🔔 Notification Alert Spam',        desc: '10 browser-style "alert" notifications fire in rapid succession.', enabled: false },
  connectionDropping:   { label: '📡 "Connection Unstable" Banner',   desc: 'Pulsing red banner: "Connection dropping — 12% packet loss detected."', enabled: false },
  inactiveAccountWarn:  { label: '😴 Account Inactivity Warning',     desc: '"Account flagged for 90-day inactivity. Reactivation required: call support."', enabled: false },
  maintenanceMode:      { label: '🔧 Scheduled Maintenance Mode',     desc: 'Grey overlay: "Scheduled maintenance in progress. Transfers resume at 2:00 AM CT."', enabled: false },
  sessionExpireSoon:    { label: '⏱️ Session Expiring in 10s Banner', desc: 'Top banner counts down from 10, then "extends" session, then starts over.', enabled: false },
  paperworkRequired:    { label: '📁 Additional Paperwork Modal',     desc: '"Upload photo ID, utility bill, and signed affidavit before transfer (PDF only)."', enabled: false },
  microDeposits:        { label: '💰 Micro-Deposit Verification',     desc: '"Two micro-deposits sent to your external bank. Verify amounts in 3-5 business days."', enabled: false },
  newPayeeCooling:      { label: '❄️ New Payee 7-Day Hold',           desc: '"New payees require 7-day security hold before first transfer per Reg D."', enabled: false },
  dailyLimitHit:        { label: '🚫 Daily Transfer Limit Reached',   desc: '"You have reached your $0.00 daily transfer limit. Limit resets in 23 hours."', enabled: false },
  complianceHold:       { label: '⚖️ BSA Compliance Hold',           desc: '"Transfer flagged for Bank Secrecy Act review. Release in 10-14 business days."', enabled: false },

  // ── PREMIUM CHAOS ──
  balanceZero:          { label: '💀 All Balances → $0.00',          desc: 'Instantly replaces all account balances with $0.00 — "skill issue" subtitle.', enabled: false },
  matrixMode:           { label: '🟢 Matrix Rain Mode',              desc: 'Green matrix code rain falls over the entire page.', enabled: false },
  invertColors:         { label: '🌈 Invert Page Colors',            desc: 'CSS filter inverts all page colors. Everything looks like an X-ray.', enabled: false },
  rickRoll:             { label: '🎵 Rick Roll Autoplay',            desc: 'Autoplays Rick Astley "Never Gonna Give You Up" at full volume.', enabled: false },
  scammerScore:         { label: '📊 Scammer Risk Score Widget',     desc: 'Injects a "Fraud Risk Score: 99/100 — HIGH" widget next to their account.', enabled: false },
  cursedCursor:         { label: '💩 Emoji Cursor Replacement',      desc: 'Replaces the cursor with a 💩 emoji.', enabled: false },
  fakeTyping:           { label: '✍️ Someone Else Is Typing...',     desc: '"Robert J. Harrington is editing this page from another device" notification.', enabled: false },
  accountDeleted:       { label: '🗑️ Account Marked for Deletion',   desc: '"This account has been scheduled for deletion in 24 hours due to fraud detection."', enabled: false },
  interpol:             { label: '🌍 INTERPOL Notice Banner',        desc: '"INTERPOL Financial Crimes Unit has been notified of this session." Red banner.', enabled: false },
  grandmaNotified:      { label: '👵 Grandma Notified Popup',        desc: 'Sincere popup: "Your grandmother has been informed of your current activities."', enabled: false },
};

const ADMIN_PASSWORD = 'scambait2024';  // Change this to whatever you want

app.use(session({
  secret: 'integrity-bank-demo-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 60 * 1000 }
}));

const ROOT = path.join(__dirname);

// Default balances for each new session
const DEFAULT_BALANCES = {
  'XXXX3198': { name: 'Premium Checking', balance: 15123.21 },
  'XXXX1329': { name: 'Joint Savings',    balance: 59141.93 },
  'XXXX6993': { name: 'Money Market',     balance: 507277.36 }
};

function getBalances(req) {
  if (!req.session.balances) {
    req.session.balances = JSON.parse(JSON.stringify(DEFAULT_BALANCES));
  }
  return req.session.balances;
}

// ── INSTANT TRIGGER QUEUE ────────────────────────────────────
// Admin can push trap keys here; the client polls and fires them immediately.
let TRIGGER_QUEUE = [];

// Static assets
app.use('/themes', express.static(path.join(ROOT, 'themes')));
app.use('/img', express.static(path.join(ROOT, 'img')));
app.use('/favicon.ico', express.static(path.join(ROOT, 'favicon.ico')));
app.get('/script.js', (req, res) => res.sendFile(path.join(ROOT, 'script.js')));

// Auth middleware
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/');
}

// Admin auth middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin');
}

// ── ADMIN ROUTES ──────────────────────────────────────────────
app.get('/fbi-warning', (req, res) => {
  res.sendFile(path.join(ROOT, 'fbi-warning.html'));
});

app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) return res.redirect('/admin/panel');
  res.sendFile(path.join(ROOT, 'admin-login.html'));
});

app.post('/admin/login', (req, res) => {
  const pw = (req.body.password || '').trim();
  if (pw === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true });
  }
  return res.json({ success: false, message: 'Wrong password.' });
});

app.get('/admin/panel', requireAdmin, (req, res) => {
  res.sendFile(path.join(ROOT, 'admin-panel.html'));
});

app.get('/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  res.redirect('/admin');
});

// Admin fires a trap instantly — pushes to queue
app.post('/api/trap-fire/:key', requireAdmin, (req, res) => {
  const key = req.params.key;
  if (!TRAPS[key]) return res.status(404).json({ success: false });
  TRIGGER_QUEUE.push(key);
  res.json({ success: true, key });
});

// Client polls this — returns pending triggers and clears queue
app.get('/api/trap-queue', requireLogin, (req, res) => {
  const pending = TRIGGER_QUEUE.slice();
  TRIGGER_QUEUE = [];
  res.json({ triggers: pending });
});

app.get('/api/traps', requireAdmin, (req, res) => {
  res.json(TRAPS);
});

app.post('/api/traps/:key', requireAdmin, (req, res) => {
  const key = req.params.key;
  if (!TRAPS[key]) return res.status(404).json({ success: false });
  TRAPS[key].enabled = req.body.enabled === true || req.body.enabled === 'true';
  res.json({ success: true, key, enabled: TRAPS[key].enabled });
});

// Public endpoint — returns only enabled/disabled booleans, NOT the admin-only data
app.get('/api/trap-config', requireLogin, (req, res) => {
  const out = {};
  Object.keys(TRAPS).forEach(k => { out[k] = TRAPS[k].enabled; });
  res.json(out);
});

// ── PUBLIC ROUTES ─────────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.session && req.session.loggedIn) return res.redirect('/account');
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.post('/login', (req, res) => {
  const username = (req.body.username || req.body.user || '').trim();
  const password = (req.body.password || req.body.pass || '').trim();
  if (username && password) {
    req.session.loggedIn = true;
    req.session.username = username;
    req.session.displayName = getDisplayName(username);
    return res.json({ success: true, redirect: '/account' });
  }
  return res.json({ success: false, message: 'Please enter your username and password.' });
});

// ── PROTECTED PAGES ───────────────────────────────────────────
app.get('/account', requireLogin, (req, res) => {
  res.sendFile(path.join(ROOT, 'account.html'));
});

app.get('/account/details', requireLogin, (req, res) => {
  res.sendFile(path.join(ROOT, 'account-details.html'));
});

app.get('/account/details/', requireLogin, (req, res) => {
  res.sendFile(path.join(ROOT, 'account-details.html'));
});

app.get('/transfer', requireLogin, (req, res) => {
  res.sendFile(path.join(ROOT, 'transfer.html'));
});

app.get('/inbox', requireLogin, (req, res) => {
  res.sendFile(path.join(ROOT, 'inbox.html'));
});

app.get('/contact', requireLogin, (req, res) => {
  res.sendFile(path.join(ROOT, 'contact.html'));
});

// Stub routes — redirect back to account with a message
app.get('/account/profile',   requireLogin, (req, res) => res.redirect('/account'));
app.get('/account/paperless', requireLogin, (req, res) => res.redirect('/account'));
app.get('/account/investing', requireLogin, (req, res) => res.redirect('/account'));

// ── API ───────────────────────────────────────────────────────
// Current session user info
app.get('/api/me', requireLogin, (req, res) => {
  res.json({ displayName: req.session.displayName || 'Valued Customer' });
});

// Get current balances
app.get('/api/balances', requireLogin, (req, res) => {
  res.json(getBalances(req));
});

// Execute a transfer
app.post('/api/transfer', requireLogin, (req, res) => {
  const { from, to, amount } = req.body;
  const balances = getBalances(req);

  if (!balances[from] || !balances[to]) {
    return res.json({ success: false, message: 'Invalid account.' });
  }
  if (from === to) {
    return res.json({ success: false, message: 'From and To accounts must be different.' });
  }
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    return res.json({ success: false, message: 'Invalid amount.' });
  }
  if (amt > balances[from].balance) {
    return res.json({ success: false, message: 'Insufficient funds.' });
  }

  balances[from].balance = Math.round((balances[from].balance - amt) * 100) / 100;
  balances[to].balance   = Math.round((balances[to].balance   + amt) * 100) / 100;
  req.session.balances = balances;

  res.json({ success: true, balances });
});

// ── LOGOUT ────────────────────────────────────────────────────
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});
app.get('/logout.php', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.listen(PORT, () => {
  console.log(`Integrity Bank running at http://localhost:${PORT}`);
});
