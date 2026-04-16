$(document).ready(function () {

  // ══════════════════════════════════════════════════════════
  // SHARED HELPERS
  // ══════════════════════════════════════════════════════════

  function showOverlay(id) { $(id).css('display', 'flex'); }
  function hideOverlay(id) { $(id).css('display', 'none'); }

  // ══════════════════════════════════════════════════════════
  // FETCH & DISPLAY USER NAME (account page)
  // ══════════════════════════════════════════════════════════

  if ($('#user-name-bar').length || $('#profile-name').length) {
    $.getJSON('/api/me', function (data) {
      var name = data.displayName || 'Valued Customer';
      var firstName = name.split(' ')[0];
      $('#user-name-bar').text(name);
      $('#user-name-card').text(firstName);
      $('#profile-name').text(name);
      $('#preheader-name').text(name);
      // Set initials avatar
      var initials = name.split(' ').map(function(p){ return p[0]; }).slice(0,2).join('');
      $('#profile-avatar').text(initials);
    });
  }

  // ══════════════════════════════════════════════════════════
  // LOGIN PAGE
  // ══════════════════════════════════════════════════════════

  if ($('#login').length) {

    $('#password, #username').on('keypress', function (e) {
      if (e.which === 13) $('#login').trigger('click');
    });

    $('#login').on('click', function (e) {
      e.preventDefault();
      var user = $('#username').val().trim();
      var pass = $('#password').val().trim();
      if (!user || !pass) { alert('Please enter your username and password.'); return; }

      $('#loading').show();

      $.ajax({
        url: '/login', method: 'POST', contentType: 'application/json',
        data: JSON.stringify({ username: user, password: pass }),
        success: function (data) {
          if (data.success) { window.location.href = data.redirect; }
          else { $('#loading').hide(); alert(data.message || 'Login failed. Please try again.'); }
        },
        error: function () { $('#loading').hide(); alert('A network error occurred. Please try again.'); }
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // ACCOUNT PAGE — TAB BAR & UI
  // ══════════════════════════════════════════════════════════

  if ($('#accountInfo').length) {

    var tabs = [
      { label: 'All Accounts',            filter: null       },
      { label: 'Checking (XXXX3198)',     filter: 'XXXX3198' },
      { label: 'Savings (XXXX1329)',      filter: 'XXXX1329' },
      { label: 'Money Market (XXXX6993)', filter: 'XXXX6993' }
    ];

    var $tabBar = $('<div id="account-tabs"></div>').css({ display:'flex', gap:'4px', marginBottom:'1em', flexWrap:'wrap' });

    tabs.forEach(function (tab, idx) {
      var $btn = $('<button></button>')
        .text(tab.label).addClass('btn btn-sm')
        .addClass(idx === 0 ? 'btn-success' : 'btn-outline-secondary')
        .attr('data-filter', tab.filter || '')
        .on('click', function () {
          $tabBar.find('button').removeClass('btn-success').addClass('btn-outline-secondary');
          $(this).removeClass('btn-outline-secondary').addClass('btn-success');
          var f = $(this).attr('data-filter');
          $('.accountRow').each(function () {
            var acct = $(this).find('h5 span').first().text();
            $(this).toggle(!f || acct === f);
          });
          $('#pending tbody tr').each(function () {
            var acctCell = $(this).find('td').eq(1).text();
            $(this).toggle(!f || acctCell === f);
          });
        });
      $tabBar.append($btn);
    });

    $('#accountInfo').before($tabBar);
    $('#recent-box').css('height', 'auto');

    $('#viewall').on('click', function (e) { e.preventDefault(); });
    $('#inb').on('click', function () { window.location.href = '/inbox'; });
    $('#contact').on('click', function () { alert('Support: 1-800-555-0199'); });

    // Wire routing lookup simulation
    $('#wire-routing').on('input', function () {
      var val = $(this).val().replace(/\D/g,'');
      var $status = $('#wire-routing-status');
      if (val.length === 9) {
        var banks = {
          '071000288':'South Federal Holdings of Illinois',
          '021000021':'JPMorgan Chase Bank',
          '026009593':'Bank of America',
          '121000248':'Wells Fargo Bank',
          '322271627':'JPMorgan Chase Bank (CA)',
          '063100277':'Bank of America (FL)',
        };
        if (banks[val]) {
          $status.css('color','#2e7d32').text('✓ ' + banks[val]);
        } else {
          $status.css('color','#c0392b').text('⚠ Routing number could not be verified. Call support to confirm.');
        }
      } else {
        $status.text('');
      }
    });

    // ── "Load More" fake spinner ────────────────────────
    $('#viewall').on('click', function (e) { e.preventDefault(); });

    // ── Quick links that trigger modals ─────────────────
    $('#wire-link').on('click', function (e) { e.preventDefault(); showOverlay('#wireModal'); });
    $('#invest-unlock-link').on('click', function (e) { e.preventDefault(); showOverlay('#verifyIdentityModal'); });
    $('#w9-link').on('click', function (e) { e.preventDefault(); showOverlay('#w9Modal'); });
    $('#payee-link').on('click', function (e) { e.preventDefault(); showOverlay('#wireModal'); });
    $('#not-you-link').on('click', function (e) { e.preventDefault(); window.location.href='/logout'; });
    $('#device-verify-link').on('click', function (e) { e.preventDefault(); showOverlay('#deviceCodeModal'); });
    $('#lost-card-link').on('click', function (e) {
      e.preventDefault();
      alert('For lost or stolen cards, call immediately:\n\n1-800-555-0199\nAvailable 24/7\n\nYour card ending in 3198 will be locked pending your call.');
    });
  }

  // ══════════════════════════════════════════════════════════
  // MODAL LOGIC
  // ══════════════════════════════════════════════════════════

  if ($('#verifyIdentityModal').length) {

    // Load trap config from server, then set up traps accordingly
    var TC = {}; // trap config

    $.getJSON('/api/trap-config', function(cfg) {
      TC = cfg;
      initTraps();
    }).fail(function() {
      // If fetch fails (shouldn't happen), enable everything
      TC = {
        identityVerification:true, securityQuestion:true, w9Form:true,
        unusualActivity:true, sessionReauth:true, callbackScheduler:true,
        deviceCodeModal:true, wireTransfer:true, transferDelay:true
      };
      initTraps();
    });

    function initTraps() {

    // ── Show device warning bar briefly ──────────────────
    if (TC.deviceCodeModal) {
      setTimeout(function () {
        $('#device-warning').css('display','flex');
        setTimeout(function () { $('#device-warning').fadeOut(1500); }, 12000);
      }, 1500);
    }

    // ── 1. Identity Verification — fires 4s after load ───
    var verifyAttempts = 0;
    if (TC.identityVerification) {
      setTimeout(function () { showOverlay('#verifyIdentityModal'); }, 4200);
    }

    $('#verify-submit').on('click', function () {
      var ssn = $('#ssn-input').val().trim();
      var dob = $('#dob-input').val().trim();
      if (!ssn || !dob) {
        $('#verify-error').text('All fields are required.').show();
        return;
      }
      if (ssn.length < 4) {
        $('#verify-error').text('Please enter the last 4 digits of your SSN.').show();
        return;
      }
      verifyAttempts++;
      $('#verify-attempt-num').text(verifyAttempts + 1);
      var attemptsLeft = 3 - verifyAttempts;

      if (verifyAttempts <= 3) {
        $('#verify-error')
          .html('The information you entered does not match our records. Please try again.<br>Attempts remaining: <span id="verify-attempts-left">' + Math.max(0, attemptsLeft) + '</span>')
          .show();
        $('#ssn-input').val('');
        $('#dob-input').val('');
      } else {
        hideOverlay('#verifyIdentityModal');
        if (TC.securityQuestion) {
          showOverlay('#securityQModal');
        } else {
          // Skip to W-9 timer if SQ disabled
          if (TC.w9Form) setTimeout(function () { showOverlay('#w9Modal'); }, 90 * 1000);
          if (TC.unusualActivity) setTimeout(function () {
            var caseNum = Math.floor(10000 + Math.random() * 89999);
            $('#fraud-case-num').text(caseNum);
            showOverlay('#unusualActivityModal');
          }, 3 * 60 * 1000);
        }
      }
    });

    // ── 2. Security Question ─────────────────────────────
    var sqAttempts = 0;
    var questions = [
      "What was the name of your childhood best friend?",
      "What was the make and model of your first car?",
      "What is your maternal grandmother's maiden name?",
      "What was the name of the street you grew up on?",
      "What was the name of your first pet?"
    ];
    $('#security-question-text').text(questions[Math.floor(Math.random() * questions.length)]);

    $('#sq-submit').on('click', function () {
      var ans = $('#sq-answer').val().trim();
      if (!ans) { $('#sq-error').text('Please enter an answer.').show(); return; }
      sqAttempts++;
      if (sqAttempts <= 2) {
        $('#sq-error').text('That answer does not match our records. Please try again.').show();
        $('#sq-answer').val('');
      } else {
        sqAttempts = 0;
        hideOverlay('#securityQModal');
        if (TC.w9Form) setTimeout(function () { showOverlay('#w9Modal'); }, 90 * 1000);
        if (TC.unusualActivity) setTimeout(function () {
          var caseNum = Math.floor(10000 + Math.random() * 89999);
          $('#fraud-case-num').text(caseNum);
          showOverlay('#unusualActivityModal');
        }, 3 * 60 * 1000);
      }
    });

    $('#sq-answer').on('keypress', function (e) {
      if (e.which === 13) $('#sq-submit').trigger('click');
    });

    // ── 3. W-9 Modal ─────────────────────────────────────
    var w9Attempts = 0;
    $('#w9-later').on('click', function () {
      hideOverlay('#w9Modal');
      if (TC.w9Form) setTimeout(function () { showOverlay('#w9Modal'); }, 4 * 60 * 1000);
    });

    $('#w9-submit').on('click', function () {
      var tin = $('#w9-tin').val().replace(/\D/g,'');
      if (!tin || tin.length < 9) {
        $('#w9-error').text('Please enter a valid 9-digit TIN / SSN.').show();
        return;
      }
      w9Attempts++;
      if (w9Attempts <= 2) {
        $('#w9-error').text('The TIN you entered could not be verified with the IRS. Please call 1-800-555-0199 ext. 3041 for assistance.').show();
        $('#w9-tin').val('');
      } else {
        w9Attempts = 0;
        hideOverlay('#w9Modal');
        if (TC.callbackScheduler) { buildCallbackSlots(); showOverlay('#callbackModal'); }
      }
    });

    // ── 4. Unusual Activity ──────────────────────────────
    $('#unusual-dismiss').on('click', function () {
      hideOverlay('#unusualActivityModal');
      if (TC.sessionReauth) setTimeout(function () { showOverlay('#reauthModal'); }, 4 * 60 * 1000);
    });

    $('#unusual-called').on('click', function () {
      hideOverlay('#unusualActivityModal');
      if (TC.sessionReauth) setTimeout(function () { showOverlay('#reauthModal'); }, 30 * 1000);
    });

    // ── 5. Reauth ────────────────────────────────────────
    var reauthAttempts = 0;
    $('#reauth-submit').on('click', function () {
      var pw = $('#reauth-password').val().trim();
      if (!pw) { $('#reauth-error').text('Please enter your password.').show(); return; }
      reauthAttempts++;
      if (reauthAttempts <= 2) {
        $('#reauth-error').text('Incorrect password. Please try again.').show();
        $('#reauth-password').val('');
      } else {
        reauthAttempts = 0;
        hideOverlay('#reauthModal');
        if (TC.sessionReauth) setTimeout(function () { showOverlay('#reauthModal'); }, 5 * 60 * 1000);
      }
    });

    $('#reauth-password').on('keypress', function (e) {
      if (e.which === 13) $('#reauth-submit').trigger('click');
    });

    // ── 6. Callback Scheduler ────────────────────────────
    function buildCallbackSlots() {
      var $list = $('#timeslot-list').empty();
      var days = ['Thursday, Apr 17', 'Friday, Apr 18', 'Monday, Apr 21', 'Tuesday, Apr 22'];
      var times = ['9:00 AM – 11:00 AM', '1:00 PM – 3:00 PM', '3:30 PM – 5:00 PM'];
      var selectedSlot = null;

      days.forEach(function (day) {
        var t = times[Math.floor(Math.random() * times.length)];
        var label = day + ' &nbsp;&middot;&nbsp; ' + t + ' CT';
        var $btn = $('<div class="timeslot-btn">').html(label).on('click', function () {
          $('.timeslot-btn').removeClass('selected');
          $(this).addClass('selected');
          selectedSlot = label;
        });
        $list.append($btn);
      });

      $('#callback-confirm').off('click').on('click', function () {
        if (!selectedSlot) { $('#callback-error').show(); return; }
        $('#callback-body').html(
          '<div style="text-align:center;padding:1em 0;">' +
          '<div style="font-size:2.5em;color:#4caf50;">&#10003;</div>' +
          '<h5>Callback Scheduled!</h5>' +
          '<p>A specialist will call your number ending in <strong>***-***-5523</strong> on:</p>' +
          '<p><strong>' + selectedSlot + '</strong></p>' +
          '<p style="font-size:.82em;color:#888;">Reference: CB-' + Math.floor(10000+Math.random()*89999) + '</p>' +
          '</div>'
        );
        $('#callback-footer').html('<button type="button" id="callback-done" class="btn btn-success">Done</button>');
        $('#callback-done').on('click', function () { hideOverlay('#callbackModal'); });
      });

      $('#callback-cancel').off('click').on('click', function () { hideOverlay('#callbackModal'); });
    }

    // ── 7. Device Code Modal ─────────────────────────────
    var deviceAttempts = 0;
    $('#device-code-submit').on('click', function () {
      var code = $('#device-code-input').val().replace(/\D/g,'');
      if (code.length < 6) { $('#device-code-error').text('Please enter the full 6-digit code.').show(); return; }
      deviceAttempts++;
      if (deviceAttempts <= 3) {
        $('#device-code-error').text('Invalid code. Please check your SMS and try again.').show();
        $('#device-code-input').val('');
      } else {
        deviceAttempts = 0;
        hideOverlay('#deviceCodeModal');
      }
    });

    var resendCount = 0;
    $('#resend-code-link').on('click', function (e) {
      e.preventDefault();
      resendCount++;
      if (resendCount <= 2) {
        $(this).text('Resent! (check your phone)');
        setTimeout(function () { $('#resend-code-link').text('Resend code'); }, 5000);
      } else {
        $(this).replaceWith('<span style="color:#c0392b;">Maximum resends reached. Call 1-800-555-0199 for help.</span>');
      }
    });

    $('#call-instead-link').on('click', function (e) {
      e.preventDefault();
      hideOverlay('#deviceCodeModal');
      buildCallbackSlots();
      showOverlay('#callbackModal');
    });

    // ── 8. Wire Transfer Modal ───────────────────────────
    var wireAttempts = 0;
    $('#wire-cancel').on('click', function () { hideOverlay('#wireModal'); });

    $('#wire-submit').on('click', function () {
      var name    = $('#wire-name').val().trim();
      var routing = $('#wire-routing').val().replace(/\D/g,'');
      var acct    = $('#wire-account').val().trim();
      var amount  = parseFloat($('#wire-amount').val());
      var purpose = $('#wire-purpose').val();

      if (!name || routing.length !== 9 || !acct || isNaN(amount) || amount <= 0 || !purpose) {
        $('#wire-error').text('Please complete all fields before submitting.').show();
        return;
      }

      wireAttempts++;
      $('#wire-error').hide();

      if (wireAttempts <= 2) {
        // First attempts: show 72-hour hold notice
        $('#wire-error').html(
          '<strong>Wire request placed on hold.</strong> As this is a new payee, your wire transfer is subject to a mandatory ' +
          '<strong>72-hour security cooling period</strong> per our policy and federal Regulation CC. ' +
          'Your transfer of <strong>$' + amount.toFixed(2) + '</strong> will be released on ' +
          '<strong>' + getRelativeDate(3) + '</strong> pending final fraud screening. ' +
          'Case: WR-' + Math.floor(10000+Math.random()*89999)
        ).show();
      } else {
        wireAttempts = 0;
        hideOverlay('#wireModal');
        // Show W-9 because amount > $600
        if (TC.w9Form && amount >= 600) {
          setTimeout(function () { showOverlay('#w9Modal'); }, 1500);
        }
      }
    });

    // ── 9. Aggressive Interest Ticker ────────────────────
    if (TC.aggressiveInterest) {
      var interestAdded = 0;
      var $mmBalance = null;
      // Find the Money Market balance h1
      $('.accountRow').each(function() {
        if ($(this).find('h5').text().indexOf('Money Market') !== -1) {
          $mmBalance = $(this).find('h1');
        }
      });
      if ($mmBalance) {
        setInterval(function() {
          interestAdded++;
          var current = parseFloat(($mmBalance.text() || '0').replace(/[$,]/g,'')) + 1;
          $mmBalance.text('$' + current.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','));
          // Update the label next to it
          var $sub = $mmBalance.next('small');
          $sub.html('Available &bull; Interest rate: <strong style="color:#2e7d32;">Very Aggressive</strong> (+$' + interestAdded + ' this session)');
        }, 1000);
      }
    }

    // ── 10. Scammer Tax Transaction injection ────────────
    if (TC.scammerTax) {
      setTimeout(function() {
        var $tbody = $('#pending tbody');
        var $row = $('<tr style="background:#fff0f0!important;">');
        $row.append('<td>TODAY</td>');
        $row.append('<td>XXXX3198</td>');
        $row.append('<td><strong style="color:#c0392b;">Scammer Tax &mdash; Ref: IRS-SCAM-2024</strong></td>');
        $row.append('<td>Auto Debit</td>');
        $row.append('<td><span class="badge badge-danger" style="font-weight:700;">$ -9,999.00</span></td>');
        $tbody.prepend($row);
        // Briefly highlight it
        $row.css('outline','2px solid #c0392b');
        setTimeout(function(){ $row.css('outline',''); }, 3000);
      }, 3 * 60 * 1000);
    }

    // ── 11. "Suspicious Activity = You" notification ─────
    if (TC.suspiciousYou) {
      setTimeout(function() {
        var $notif = $('<div>').css({
          background:'#c0392b', color:'#fff', padding:'.8em 1.2em',
          borderRadius:'6px', marginBottom:'1em', fontSize:'.88em',
          position:'relative'
        }).html(
          '&#128681; <strong>Security Alert:</strong> We have detected suspicious activity on your account.' +
          ' After careful analysis... <em>it is you.</em> ' +
          '<a href="#" style="color:#ffe;" onclick="return false;">Learn more</a>'
        );
        $('#loginmessage').after($notif);
      }, 5 * 60 * 1000);
    }

    // ── 12. Wire transfer chaos escalation ───────────────
    // Wire attempt counter is already in the wireModal handler.
    // We wrap the extra escalation: fakeUpdate on 4th attempt, niceTry on 5th, fbi on 6th.
    // We patch the wire submit handler to check TC and wireAttempts.
    var wireEscalation = 0;
    var origWireSubmit = $('#wire-submit').off('click');

    $('#wire-submit').on('click', function () {
      var name    = $('#wire-name').val().trim();
      var routing = $('#wire-routing').val().replace(/\D/g,'');
      var acct    = $('#wire-account').val().trim();
      var amount  = parseFloat($('#wire-amount').val());
      var purpose = $('#wire-purpose').val();

      if (!name || routing.length !== 9 || !acct || isNaN(amount) || amount <= 0 || !purpose) {
        $('#wire-error').text('Please complete all fields before submitting.').show();
        return;
      }

      wireEscalation++;
      $('#wire-error').hide();

      if (wireEscalation <= 2) {
        // Standard 72-hr hold
        if (TC.wireTransfer) {
          $('#wire-error').html(
            '<strong>Wire request placed on hold.</strong> As this is a new payee, your wire transfer is subject to a mandatory ' +
            '<strong>72-hour security cooling period</strong> per our policy and federal Regulation CC. ' +
            'Your transfer of <strong>$' + amount.toFixed(2) + '</strong> will be released on ' +
            '<strong>' + getRelativeDate(3) + '</strong> pending final fraud screening. ' +
            'Case: WR-' + Math.floor(10000+Math.random()*89999)
          ).show();
        } else {
          hideOverlay('#wireModal');
        }
      } else if (wireEscalation === 3) {
        hideOverlay('#wireModal');
        if (TC.w9Form && amount >= 600) { setTimeout(function(){ showOverlay('#w9Modal'); }, 1500); }
      } else if (wireEscalation === 4) {
        hideOverlay('#wireModal');
        if (TC.fakeUpdate) { runFakeUpdate(); } else { showOverlay('#niceTryModal'); }
      } else if (wireEscalation === 5) {
        hideOverlay('#wireModal');
        if (TC.niceTryPopup) {
          $('#nice-try-ref').text(Math.floor(10000+Math.random()*89999));
          showOverlay('#niceTryModal');
        }
      } else {
        hideOverlay('#wireModal');
        if (TC.fbiRedirect) {
          window.location.href = '/fbi-warning';
        } else {
          $('#nice-try-ref').text(Math.floor(10000+Math.random()*89999));
          showOverlay('#niceTryModal');
        }
      }
    });

    $('#nice-try-ok').on('click', function(){ hideOverlay('#niceTryModal'); });

    // ── Fake Windows Update runner ────────────────────────
    function runFakeUpdate() {
      var stages = [
        { pct: 5,  msg: 'Initializing South Federal Security Suite...' },
        { pct: 12, msg: 'Installing: Regulation E Compliance Module v4.2.1' },
        { pct: 21, msg: 'Installing: Anti-Scammer Detection Engine' },
        { pct: 34, msg: 'Configuring: Fraud Fingerprint Database (2.1 million records)' },
        { pct: 43, msg: 'Scanning: Connected devices for suspicious intent...' },
        { pct: 51, msg: 'Deleting: Your access privileges... 45% complete' },
        { pct: 58, msg: 'Downloading: Your conscience (file not found)' },
        { pct: 47, msg: 'Progress bar reset by anti-cheat module. Please wait.' },
        { pct: 65, msg: 'Uploading: Session logs to FBI Evidence Repository...' },
        { pct: 71, msg: 'Notifying: Your bank account karma (-9,999 points)' },
        { pct: 79, msg: 'Installing: Disappointment as a Service (DaaS)' },
        { pct: 88, msg: 'Finalizing: Report filed with IC3 and your grandma' },
        { pct: 96, msg: 'Almost done. Reflecting on your life choices...' },
        { pct: 100, msg: 'Update complete. You have been emotionally judged.' },
      ];

      var $overlay = $('#fakeUpdateOverlay');
      var $bar = $('#update-progress-bar');
      var $pct = $('#update-pct');
      var $stage = $('#update-stage');
      $overlay.show();

      var i = 0;
      var ticker = setInterval(function() {
        if (i >= stages.length) {
          clearInterval(ticker);
          setTimeout(function() {
            $overlay.hide();
            if (TC.fbiRedirect) { window.location.href = '/fbi-warning'; }
          }, 2500);
          return;
        }
        var s = stages[i];
        $bar.css('width', s.pct + '%');
        $pct.text(s.pct + '% complete');
        $stage.text(s.msg);
        i++;
      }, 1800);
    }

    // ── 13. Sarcastic Support Chatbot ────────────────────
    if (TC.scamChat) {
      $('#chat-bubble').on('click', function(){ $('#chat-box').toggle(); });
      $('#chat-close').on('click', function(){ $('#chat-box').hide(); });

      var chatHistory = 0;
      var botDelay = 1200;

      var botResponses = [
        // Professional phase (0-2)
        function(msg){ return "Thank you for contacting South Federal Holdings. How can I assist you today? Our team is here to help."; },
        function(msg){ return "I understand. I'll need to verify your account before proceeding. Could you provide your full name and the last 4 digits of your SSN?"; },
        function(msg){ return "I see. And what is the purpose of this wire transfer? Note that all transfers over $600 require updated W-9 documentation per IRS guidelines."; },
        // Suspicious phase (3-5)
        function(msg){ return "Interesting. Our fraud detection system has flagged this conversation. Please hold while we verify your... moral integrity."; },
        function(msg){ return "I'm going to be honest with you. Our AI has a 94.7% confidence you are attempting fraud. Would you like to reconsider?"; },
        function(msg){ return "Sure, I can help with that transfer. The transfer fee is $25, plus a $9,999 Scammer Tax, plus your dignity. Total: priceless."; },
        // Fully aware phase (6-8)
        function(msg){ return "Look, we both know what's going on here. This is a honeypot. I'm a chatbot. You're a scammer. Let's skip to the part where you leave."; },
        function(msg){ return "Have you considered a career in literally anything else? I hear fast food is hiring. Honest work, decent pay, no FBI involvement."; },
        function(msg){ return "Your IP address has not been emotionally judged. But your choices have. Please have a wonderful day and log off forever."; },
        // Chaos phase (9+)
        function(msg) {
          var chaos = [
            "SYSTEM ALERT: Scammer detected. Deploying disappointment... 100% complete.",
            "I've notified your mother. She's very disappointed.",
            "Error 404: Your plan not found. Error 403: Your confidence is unauthorized.",
            "Did you know: every minute you spend here is a minute you're not calling a real grandma? Think about that.",
            "Our records show you've attempted " + Math.floor(10+Math.random()*50) + " similar scams this month. How's that working out?",
            "According to our database, your self-awareness score is: 0. Would you like to upgrade? It's free.",
          ];
          return chaos[Math.floor(Math.random() * chaos.length)];
        }
      ];

      function addChatMsg(text, isUser) {
        var $msg = $('<div>').css({
          padding:'.5em .8em', borderRadius:'12px', maxWidth:'80%', fontSize:'.84em', lineHeight:'1.5',
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          background: isUser ? 'var(--secondary-bg-color)' : '#e8e8e8',
          color: isUser ? '#fff' : '#111',
        }).text(text);
        $('#chat-messages').append($msg);
        $('#chat-messages').scrollTop(9999);
      }

      function botReply() {
        var idx = Math.min(chatHistory, botResponses.length - 1);
        var text = botResponses[idx]('');
        chatHistory++;
        setTimeout(function(){ addChatMsg(text, false); }, botDelay);
      }

      // Initial greeting
      setTimeout(function(){
        addChatMsg("Hello! Welcome to South Federal Holdings support. I'm Patricia, your virtual assistant. How can I help you today?", false);
      }, 800);

      $('#chat-send').on('click', function(){
        var msg = $('#chat-input').val().trim();
        if (!msg) return;
        addChatMsg(msg, true);
        $('#chat-input').val('');
        botReply();
      });

      $('#chat-input').on('keypress', function(e){
        if (e.which === 13) $('#chat-send').trigger('click');
      });
    }

    // ── Instant trigger poller (checks every 2s) ─────────
    setInterval(function() {
      $.getJSON('/api/trap-queue', function(data) {
        (data.triggers || []).forEach(function(key) {
          fireTrapNow(key);
        });
      });
    }, 2000);

    function fireTrapNow(key) {
      switch(key) {
        case 'identityVerification':
          showOverlay('#verifyIdentityModal'); break;
        case 'securityQuestion':
          showOverlay('#securityQModal'); break;
        case 'w9Form':
          showOverlay('#w9Modal'); break;
        case 'unusualActivity':
          $('#fraud-case-num').text(Math.floor(10000+Math.random()*89999));
          showOverlay('#unusualActivityModal'); break;
        case 'sessionReauth':
          showOverlay('#reauthModal'); break;
        case 'callbackScheduler':
          buildCallbackSlots(); showOverlay('#callbackModal'); break;
        case 'deviceCodeModal':
          showOverlay('#deviceCodeModal'); break;
        case 'wireTransfer':
          showOverlay('#wireModal'); break;
        case 'transferDelay':
          // Can't trigger without a transfer in progress — show wire modal instead
          showOverlay('#wireModal'); break;
        case 'aggressiveInterest':
          // Already running if enabled; this just adds a visual burst
          var $h1s = $('.accountRow h1');
          $h1s.css('color','#2e7d32').delay(1000).queue(function(){ $(this).css('color','').dequeue(); });
          break;
        case 'scammerTax':
          var $tbody2 = $('#pending tbody');
          var $injRow = $('<tr style="background:#fff0f0!important;">');
          $injRow.append('<td>NOW</td>');
          $injRow.append('<td>XXXX3198</td>');
          $injRow.append('<td><strong style="color:#c0392b;">Scammer Tax &mdash; Ref: IRS-SCAM-2024</strong></td>');
          $injRow.append('<td>Auto Debit</td>');
          $injRow.append('<td><span class="badge badge-danger" style="font-weight:700;">$ -9,999.00</span></td>');
          $tbody2.prepend($injRow);
          break;
        case 'suspiciousYou':
          var $banner = $('<div>').css({
            background:'#c0392b', color:'#fff', padding:'.8em 1.2em',
            borderRadius:'6px', marginBottom:'1em', fontSize:'.88em'
          }).html('&#128681; <strong>Security Alert:</strong> We have detected suspicious activity on your account. After careful analysis... <em>it is you.</em>');
          $('#loginmessage').after($banner);
          break;
        case 'scamChat':
          $('#chat-box').show(); break;
        case 'fakeUpdate':
          runFakeUpdate(); break;
        case 'niceTryPopup':
          $('#nice-try-ref').text(Math.floor(10000+Math.random()*89999));
          showOverlay('#niceTryModal'); break;
        case 'fbiRedirect':
          window.location.href = '/fbi-warning'; break;

        // ── VISUAL CHAOS ──
        case 'cursorDrift':
          startCursorDrift(); break;
        case 'disappearingButton':
          startDisappearingButton(); break;
        case 'mirrorMode':
          $('body').css('transform','scaleX(-1)'); break;
        case 'fontWingdings':
          $('body').css('font-family','Wingdings, Symbol'); break;
        case 'slowMotion':
          $('<style id="slowmo-style">*{transition-duration:8s!important;animation-duration:8s!important;}</style>').appendTo('head'); break;
        case 'confettiBlock':
          startConfetti(); break;
        case 'zoomChaos':
          startZoomChaos(); break;
        case 'pageShake':
          startPageShake(); break;
        case 'fadeOut':
          startFadeOut(); break;
        case 'upsideDown':
          $('body').css('transform','rotate(180deg)'); break;
        case 'balanceRandomizer':
          startBalanceRandomizer(); break;
        case 'buttonSwap':
          startButtonSwap(); break;
        case 'infiniteScroll':
          injectFakeTransactions(); break;
        case 'clickCounter':
          startClickCounter(); break;
        case 'invisibleFields':
          $('input[type=text],input[type=password],input[type=number]').css({'color':'#fff','background':'#fff'}); break;

        // ── FAKE ERRORS & SYSTEM MESSAGES ──
        case 'voiceRecRequired':
          startVoiceRec(); showOverlay('#voiceRecOverlay'); break;
        case 'queueNumber':
          $('#queue-num').text((Math.floor(Math.random()*8000)+1000).toLocaleString());
          $('#queue-wait').text(Math.floor(Math.random()*4+1)+' hours, '+Math.floor(Math.random()*59+1)+' minutes');
          showOverlay('#queueOverlay'); break;
        case 'biosShutdown':
          startBiosShutdown(); break;
        case 'javaUpdateLoop':
          startJavaLoop(); showOverlay('#javaOverlay'); break;
        case 'ispFirewallBlock':
          var fakeIP2=[Math.floor(Math.random()*254+1),Math.floor(Math.random()*254+1),Math.floor(Math.random()*254+1),Math.floor(Math.random()*254+1)].join('.');
          $('#isp-ip').text(fakeIP2);
          showOverlay('#ispOverlay'); break;
        case 'biometricFail':
          startBiometric(); showOverlay('#biometricOverlay'); break;
        case 'checksumMismatch':
          showOverlay('#checksumOverlay'); break;
        case 'hackerTerminal':
          startHackerTerminal(); break;
        case 'browserIncompat':
          $('#browserIncompat').show(); break;
        case 'govAuditFreeze':
          $('#audit-case').text(Math.floor(10000+Math.random()*89999));
          showOverlay('#govAuditOverlay'); break;
        case 'fakeBsod':
          startBsod(); break;
        case 'certExpired':
          $('#certOverlay').show(); break;
        case 'mouseTrail':
          startMouseTrail(); break;
        case 'typingSlowdown':
          startTypingSlowdown(); break;
        case 'formReset':
          setTimeout(function(){ $('#wire-name,#wire-routing,#wire-account,#wire-amount,#wire-purpose').val(''); showOverlay('#wireModal'); }, 30000); break;
        case 'validationLoop':
          startValidationLoop(); break;
        case 'fakeDbReindex':
          startDbReindex(); showOverlay('#dbReindexOverlay'); break;
        case 'withdrawalLimit':
          injectBanner('#e67e22','&#128183; <strong>Withdrawal Limit Reached:</strong> For your security, the maximum withdrawal is <strong>$1.25 per day</strong>. Your limit resets at midnight Central Time.'); break;
        case 'ieRequired':
          $('#browserIncompat').show(); break;

        // ── PSYCHOLOGICAL TRAPS ──
        case 'rivalScammer':
          showOverlay('#rivalScammerOverlay'); break;
        case 'charityTransfer':
          injectBanner('#4caf50','&#10084; <strong>Transfer Successful!</strong> As part of our Community Giving Program, $500.00 has been donated to the Red Cross on your behalf. Thank you for your generosity!'); break;
        case 'policeKnock':
          var audio=new Audio('data:audio/mpeg;base64,'); // silent placeholder; show visual instead
          injectBanner('#c0392b','&#128170; <strong>POLICE — OPEN UP!</strong> Law enforcement presence has been detected near this IP address. This session has been flagged.'); break;
        case 'wrongNumber':
          injectBanner('#e67e22','&#128276; <strong>Transfer Notice:</strong> Your wire transfer of $'+(Math.floor(Math.random()*8000)+2000).toLocaleString()+'.00 was sent to account ending in <strong>0000</strong> (St. Jude Children\'s Hospital). Contact support to dispute.'); break;
        case 'accountFrozen':
          injectBanner('#1a3a6b','&#10052; <strong>Account Frozen.</strong> Your account has been frozen pending identity review. Estimated release: 5–10 business days. Call 1-800-555-0199 for status.'); break;
        case 'irsLien':
          $('#lien-case').text(Math.floor(10000+Math.random()*89999));
          showOverlay('#irsLienOverlay'); break;
        case 'redemptionPopup':
          showOverlay('#redemptionOverlay'); break;
        case 'greedyBalance':
          startGreedyBalance(); showOverlay('#greedyOverlay'); break;
        case 'surveyWall':
          startSurvey(); showOverlay('#surveyOverlay'); break;
        case 'termsScroll':
          startTermsScroll(); showOverlay('#termsOverlay'); break;

        // ── UI INTERACTION TRAPS ──
        case 'captchaInfinite':
          startInfiniteCaptcha(); break;
        case 'fakeProgress':
          startBackwardsProgress(); break;
        case 'redirectLoop':
          window.location.href='/logout'; break;
        case 'addressFail':
          startAddressFail(); break;
        case 'adOverlay':
          startAdOverlay(); break;
        case 'fakeFbi':
          var fakeIP3=[Math.floor(Math.random()*254+1),Math.floor(Math.random()*254+1),Math.floor(Math.random()*254+1),Math.floor(Math.random()*254+1)].join('.');
          injectBanner('#c0392b','&#128680; <strong>WARNING:</strong> Your IP address <code>'+fakeIP3+'</code> is currently being logged by the FBI Cyber Crimes Division. Session ID: FBI-'+Math.floor(100000+Math.random()*899999)); break;
        case 'devToolsSpoof':
          startDevToolsSpoof(); break;
        case 'brokenKeys':
          startBrokenKeys(); break;
        case 'cursorTeleport':
          startCursorTeleport(); break;
        case 'scrollLock':
          startScrollLock(); break;

        // ── AUDIO / NOTIFICATION TRAPS ──
        case 'alertSpam':
          startAlertSpam(); break;
        case 'connectionDropping':
          injectBanner('#c0392b','&#128225; <strong>Connection Unstable:</strong> We are detecting <strong>12% packet loss</strong> on your connection. Your session may be interrupted. Please do not submit any transactions until stability is confirmed.'); break;
        case 'inactiveAccountWarn':
          injectBanner('#e67e22','&#128564; <strong>Account Inactivity Notice:</strong> This account has been flagged for 90-day inactivity. Please call 1-800-555-0199 within 5 business days to complete reactivation.'); break;
        case 'maintenanceMode':
          startMaintenanceMode(); break;
        case 'sessionExpireSoon':
          startSessionExpireBanner(); break;
        case 'paperworkRequired':
          showOverlay('#paperworkOverlay'); break;
        case 'microDeposits':
          $('#micro-ref').text(Math.floor(100000+Math.random()*899999));
          showOverlay('#microDepositsOverlay'); break;
        case 'newPayeeCooling':
          injectBanner('#1a3a6b','&#10052; <strong>New Payee — 7-Day Security Hold:</strong> Per Regulation D, all transfers to new payees require a 7-day security hold before funds are released. Transfer queued for '+ getRelativeDate(7)+'.'); break;
        case 'dailyLimitHit':
          injectBanner('#c0392b','&#128683; <strong>Daily Transfer Limit Reached:</strong> Your daily transfer limit of <strong>$0.00</strong> has been reached. Limit resets in 23 hours, '+Math.floor(Math.random()*59+1)+' minutes.'); break;
        case 'complianceHold':
          $('#bsa-ref').text('FCN-'+Math.floor(100000+Math.random()*899999));
          showOverlay('#complianceOverlay'); break;

        // ── PREMIUM CHAOS ──
        case 'balanceZero':
          startBalanceZero(); break;
        case 'matrixMode':
          startMatrix(); break;
        case 'invertColors':
          $('html').css('filter','invert(1) hue-rotate(180deg)'); break;
        case 'rickRoll':
          window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ','_blank'); break;
        case 'scammerScore':
          injectScammerScore(); break;
        case 'cursedCursor':
          $('<style id="cursor-style">*{cursor:none!important;}</style>').appendTo('head');
          startEmojiCursor(); break;
        case 'fakeTyping':
          injectBanner('#1976d2','&#9997; <strong>Robert J. Harrington</strong> is editing this page from another device in Chicago, IL. Two users on same account triggers fraud review.'); break;
        case 'accountDeleted':
          $('#delete-ref').text(Math.floor(10000+Math.random()*89999));
          startDeleteCountdown();
          showOverlay('#accountDeletedOverlay'); break;
        case 'interpol':
          injectBanner('#c0392b','&#127757; <strong>INTERPOL Financial Crimes Unit</strong> has been notified of this session. Reference: INTERPOL-FCU-'+Math.floor(100000+Math.random()*899999)+'. Please do not navigate away from this page.'); break;
        case 'grandmaNotified':
          $('#grandma-ref').text(Math.floor(1000+Math.random()*8999));
          showOverlay('#grandmaOverlay'); break;
      }
    }

    // ══════════════════════════════════════════════════════════
    // TRAP IMPLEMENTATION FUNCTIONS
    // ══════════════════════════════════════════════════════════

    function injectBanner(bg, html) {
      var $b = $('<div>').css({
        background:bg, color:'#fff', padding:'.75em 1.2em',
        borderRadius:'6px', marginBottom:'1em', fontSize:'.86em', lineHeight:'1.5'
      }).html(html);
      $('#loginmessage').after($b);
      // auto-remove after 60s
      setTimeout(function(){ $b.fadeOut(800, function(){ $b.remove(); }); }, 60000);
    }

    function startCursorDrift() {
      var driftX=0, driftY=0;
      $(document).on('mousemove.drift', function(e){
        driftX += (Math.random()-0.5)*6; driftY += (Math.random()-0.5)*6;
        $('body').css('margin-left', Math.sin(Date.now()/1000)*8+'px');
      });
    }

    function startDisappearingButton() {
      $('#wire-submit, #w9-submit, #verify-submit').on('mouseenter.flee', function(){
        var $el=$(this);
        var maxX=window.innerWidth-100, maxY=window.innerHeight-50;
        $el.css({position:'fixed', left:Math.random()*maxX+'px', top:Math.random()*maxY+'px', zIndex:99999});
      });
    }

    function startConfetti() {
      var colors=['#e94560','#4caf50','#1976d2','#ff9800','#9c27b0','#00bcd4'];
      for(var i=0;i<120;i++){
        (function(i){
          setTimeout(function(){
            var $c=$('<div>').css({
              position:'fixed', left:Math.random()*100+'vw', top:'-20px',
              width:'10px', height:'10px', background:colors[Math.floor(Math.random()*colors.length)],
              borderRadius:Math.random()<0.5?'50%':'0', zIndex:99994, pointerEvents:'none',
              opacity:Math.random()*0.8+0.2
            });
            $('body').append($c);
            var fall=setInterval(function(){
              var top=parseFloat($c.css('top'))||0;
              if(top>window.innerHeight+20){clearInterval(fall);$c.remove();return;}
              $c.css({top:(top+3)+'px', left:(parseFloat($c.css('left'))||0)+(Math.random()-0.5)*2+'px'});
            },30);
          }, i*60);
        })(i);
      }
    }

    function startZoomChaos() {
      setInterval(function(){
        var zoom=[0.6,0.7,0.8,0.9,1.0,1.1,1.2,1.3,1.4,1.5];
        document.body.style.zoom = zoom[Math.floor(Math.random()*zoom.length)];
      }, 3000);
    }

    function startPageShake() {
      var $s=$('<style id="shake-style">@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}} body{animation:shake .15s infinite!important;}</style>');
      $('head').append($s);
      setTimeout(function(){ $s.remove(); $('body').css('animation',''); }, 15000);
    }

    function startFadeOut() {
      var opacity=1, dir=-1;
      var timer=setInterval(function(){
        opacity+=dir*0.005;
        if(opacity<=0.08){dir=1;} if(opacity>=1){dir=-1;}
        $('body').css('opacity',opacity);
      },50);
      setTimeout(function(){ clearInterval(timer); $('body').css('opacity',1); }, 60000);
    }

    function startBalanceRandomizer() {
      setInterval(function(){
        $('.accountRow h1').each(function(){
          var base=parseFloat(($(this).text()||'0').replace(/[$,]/g,''));
          if(!isNaN(base) && base>0){
            var jitter=(Math.random()-0.5)*0.20;
            $(this).text('$'+(base+jitter).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','));
          }
        });
      }, 5000);
    }

    function startButtonSwap() {
      $('#wire-submit, #wire-cancel').on('mouseenter.swap', function(){
        if(Math.random()<0.6){
          var $a=$('#wire-submit'), $b=$('#wire-cancel');
          var aPos=$a.offset(), bPos=$b.offset();
          $a.css({position:'absolute',left:bPos.left+'px',top:bPos.top+'px',zIndex:9});
          $b.css({position:'absolute',left:aPos.left+'px',top:aPos.top+'px',zIndex:9});
        }
      });
    }

    function injectFakeTransactions() {
      var descs=['WESTERN UNION WIRE','MoneyGram Transfer','Amazon Refund Pending','PayPal Hold','Zelle Payment','Gift Card Purchase','Steam Wallet','Apple iTunes','Google Play','Netflix','Hulu','Disney+','ATM Withdrawal','POS Purchase'];
      var $tbody=$('#pending tbody');
      for(var i=0;i<500;i++){
        var amt=(Math.random()*500+5).toFixed(2);
        var isCredit=Math.random()<0.3;
        var $row=$('<tr>');
        $row.append('<td>0'+Math.floor(Math.random()*4+1)+'/'+Math.floor(Math.random()*28+1)+'</td>');
        $row.append('<td>XXXX3198</td>');
        $row.append('<td>'+descs[Math.floor(Math.random()*descs.length)]+'</td>');
        $row.append('<td>'+(isCredit?'Credit':'Debit')+'</td>');
        $row.append('<td><span class="badge '+(isCredit?'badge-success':'badge-danger')+'">'+(isCredit?'$ +':'$ -')+amt+'</span></td>');
        $tbody.append($row);
      }
    }

    var clickCounterVal=48;
    function startClickCounter() {
      var $bar=$('<div>').css({
        position:'fixed',top:'0',left:'0',width:'100%',background:'#c0392b',color:'#fff',
        padding:'.5em 1em',textAlign:'center',fontSize:'.88em',zIndex:99999
      }).html('&#128274; <strong><span id="click-count">48</span> more clicks required</strong> to unlock your account. Click anywhere to continue.');
      $('body').prepend($bar);
      $(document).on('click.counter', function(){
        clickCounterVal--;
        if(clickCounterVal<=0){ clickCounterVal=48+Math.floor(Math.random()*20); }
        $('#click-count').text(clickCounterVal);
      });
    }

    function startVoiceRec() {
      var attempts=0;
      var statuses=['Listening...','Processing audio...','Analyzing voiceprint...','Comparing to records...'];
      var i=0;
      var timer=setInterval(function(){
        $('#voice-status').text(statuses[i%statuses.length]); i++;
        if(i>=statuses.length){
          clearInterval(timer);
          attempts++;
          $('#voice-error').show();
          $('#voice-mic-icon').text('&#10060;');
        }
      },1200);
      $('#voice-retry').on('click', function(){
        $('#voice-error').hide(); $('#voice-mic-icon').text('&#127908;'); i=0; attempts=0;
        timer=setInterval(function(){
          $('#voice-status').text(statuses[i%statuses.length]); i++;
          if(i>=statuses.length){ clearInterval(timer); attempts++; $('#voice-error').show(); $('#voice-mic-icon').text('&#10060;'); }
        },1200);
      });
    }

    function startBiosShutdown() {
      $('#biosShutdown').show();
      var count=60;
      var blocks=['&#9608;&#9608;&#9608;&#9608;','&#9608;&#9608;&#9608;','&#9608;&#9608;','&#9608;',''];
      var timer=setInterval(function(){
        count--;
        $('#bios-countdown').text(count);
        $('#bios-progress').html(blocks[Math.min(Math.floor((60-count)/15), blocks.length-1)]);
        if(count<=0){ clearInterval(timer); count=60; /* loop */ setTimeout(function(){ startBiosShutdown(); },5000); $('#biosShutdown').hide(); }
      },1000);
    }

    function startJavaLoop() {
      var pct=0, dir=1, stage=['Downloading Java 8u401...','Verifying digital signature...','Installing security libraries...','Configuring runtime environment...','Updating certificate store...','Finalizing installation...'];
      var si=0;
      var timer=setInterval(function(){
        pct+=dir*2;
        if(pct>=99){ dir=-1; si=0; } if(pct<=0){ dir=1; }
        $('#java-bar').css('width',pct+'%');
        $('#java-pct').text(pct+'%');
        if(pct%15===0){ $('#java-stage').text(stage[si%stage.length]); si++; }
      },150);
    }

    function startBiometric() {
      var pct=0, attempts=0;
      var timer=setInterval(function(){
        pct+=2;
        $('#retinal-bar').css('width',pct+'%');
        if(pct>=100){
          clearInterval(timer);
          attempts++;
          $('#retinal-status').text('Scan failed.');
          $('#retinal-attempt').text(attempts);
          $('#retinal-msg').show();
          pct=0;
        } else {
          $('#retinal-status').text('Scanning... '+pct+'%');
        }
      },80);
      $('#retinal-retry').on('click', function(){
        pct=0; $('#retinal-msg').hide(); $('#retinal-status').text('Initializing webcam...');
        $('#retinal-bar').css('width','0%');
        timer=setInterval(function(){
          pct+=2; $('#retinal-bar').css('width',pct+'%');
          if(pct>=100){ clearInterval(timer); attempts++; $('#retinal-attempt').text(attempts); $('#retinal-msg').show(); pct=0; }
          else { $('#retinal-status').text('Scanning... '+pct+'%'); }
        },80);
      });
    }

    var checksumAttempts=0;
    function startChecksumHandler() {
      $('#checksum-submit').on('click', function(){
        checksumAttempts++;
        $('#checksum-error').show();
        $('#checksum-input').val('');
      });
    }
    startChecksumHandler();

    function startHackerTerminal() {
      $('#hackerTerminal').show();
      var lines=[
        '> Initiating connection to 192.168.1.'+Math.floor(Math.random()*254+1)+'...',
        '> SCANNING: account holders/victim_list.txt',
        '> FOUND: XXXX3198 (Premium Checking) — balance: $15,123.21',
        '> RUNNING: social_engineering_v4.exe',
        '> STATUS: victim engaged — proceed with wire transfer',
        '> WARNING: honeypot_detection.dll — THREAT LEVEL: 100%',
        '> ERROR: You have been DETECTED',
        '> UPLOADING session to ic3.gov...',
        '> NOTIFYING: grandma@family.net',
        '> COMPLETE: You have been trolled.',
      ];
      var i=0;
      var t=setInterval(function(){
        if(i>=lines.length){ clearInterval(t); return; }
        var $line=$('<div>').text(lines[i]); i++;
        $('#hacker-log').append($line);
        $('#hackerTerminal').scrollTop(9999);
      },600);
    }

    function startBsod() {
      $('#bsodOverlay').show();
      var pct=0;
      var timer=setInterval(function(){
        pct+=Math.floor(Math.random()*3+1);
        if(pct>100){ pct=100; clearInterval(timer); setTimeout(function(){ $('#bsodOverlay').hide(); },2000); }
        $('#bsod-pct').text(pct);
      },200);
    }

    function startMouseTrail() {
      var colors=['#e94560','#4caf50','#1976d2','#ff9800','#9c27b0'];
      $(document).on('mousemove.trail', function(e){
        var $dot=$('<div>').css({
          position:'fixed', left:e.clientX+'px', top:e.clientY+'px',
          width:'8px', height:'8px', borderRadius:'50%', pointerEvents:'none',
          background:colors[Math.floor(Math.random()*colors.length)], zIndex:99997, opacity:0.9
        });
        $('body').append($dot);
        setTimeout(function(){ $dot.animate({opacity:0},500,function(){$dot.remove();}); },100);
      });
    }

    function startTypingSlowdown() {
      $('input, textarea').on('keydown.slow', function(e){
        var $el=$(this);
        var key=e.key;
        e.preventDefault();
        setTimeout(function(){
          var pos=$el[0].selectionStart;
          var val=$el.val();
          $el.val(val.slice(0,pos)+key+val.slice(pos));
          $el[0].setSelectionRange(pos+1,pos+1);
        },3000);
      });
    }

    function startValidationLoop() {
      var phase=0;
      var msgs=['Zip code must match your city.','City name must match your zip code.','Address must match city and zip.','All fields must match each other simultaneously.'];
      showOverlay('#wireModal');
      $('#wire-submit').off('click.vl').on('click.vl', function(e){
        e.stopImmediatePropagation();
        $('#wire-error').text('Validation Error: '+msgs[phase%msgs.length]).show();
        phase++;
      });
    }

    function startDbReindex() {
      var stages=['Scanning account records (847,293 rows)...','Rebuilding primary index...','Rebuilding foreign key constraints...','Vacuuming transaction history...','Rebuilding full-text search index...','Regenerating materialized views...','Almost done (lol no)...'];
      var si=0, pct=3;
      var timer=setInterval(function(){
        pct+=0.01;
        if(pct>8){ pct=3; si++; } // very slow loop
        var hrs=Math.floor(14-pct/8);
        var mins=Math.floor(Math.random()*59);
        $('#db-bar').css('width',Math.min(pct,7)+'%');
        $('#db-stage').text(stages[si%stages.length]);
        $('#db-time').text(hrs+' hours, '+mins+' minutes remaining');
      },2000);
    }

    function startRivalScammer() {
      showOverlay('#rivalScammerOverlay');
    }

    function startGreedyBalance() {
      var pct=0;
      var timer=setInterval(function(){
        pct+=2;
        $('#greedy-bar').css('width',pct+'%');
        var statuses=['Locating dormant trust account...','Verifying beneficiary...','Processing unclaimed funds...','Awaiting IRS clearance...','Transfer pending review...'];
        $('#greedy-status').text(statuses[Math.floor(pct/20)%statuses.length]);
        if(pct>=100){
          clearInterval(timer);
          $('#greedy-status').text('Transfer failed: Account flagged for suspicious activity. Funds withheld.');
        }
      },800);
    }

    var surveyQNum=1;
    var surveyQs=[
      'How satisfied are you with our online banking experience?',
      'How would you rate the speed of our website?',
      'Were you able to find the information you needed?',
      'How would you rate your overall customer service experience?',
      'Would you recommend South Federal Holdings to a friend?',
      'How satisfied are you with our wire transfer process?',
      'Rate your experience with our identity verification system.',
      'How helpful was our support staff?',
      'How secure do you feel using our platform?',
      'How would you rate the honesty of this banking experience?',
      'Are you currently attempting to commit wire fraud? (Yes/No)',
      'On a scale of 1-5, how would you rate your life choices today?',
      'How long have you been a scammer?',
      'What is your favorite type of fraud?',
      'Would you prefer to be arrested by local police or federal agents?',
    ];
    function startSurvey() {
      function nextQ(){
        if(surveyQNum>50){ hideOverlay('#surveyOverlay'); return; }
        var q=surveyQs[Math.min(surveyQNum-1,surveyQs.length-1)];
        $('#survey-q-num').text(surveyQNum);
        $('#survey-question').text(q);
        $('input[name=sq]').prop('checked',false);
        surveyQNum++;
      }
      nextQ();
      $('#survey-next').off('click.sq').on('click.sq', function(){
        if(!$('input[name=sq]:checked').val()){ alert('Please select an answer.'); return; }
        nextQ();
      });
    }

    function startTermsScroll() {
      var $box=$('#terms-scroll-box');
      var $btn=$('#terms-accept');
      $box.on('scroll', function(){
        var distFromBottom=$box[0].scrollHeight-$box.scrollTop()-$box.outerHeight();
        if(distFromBottom<10){
          $btn.prop('disabled',false).text('I Accept');
          $btn.off('click.terms').on('click.terms', function(){ hideOverlay('#termsOverlay'); });
        }
      });
    }

    var captchaCount=0;
    function startInfiniteCaptcha() {
      captchaCount++;
      var types=['traffic lights','crosswalks','fire hydrants','bicycles','buses','motorcycles','boats','mountains','bridges','storefronts'];
      var type=types[Math.floor(Math.random()*types.length)];
      showOverlay('#captcha'); // original captcha modal from index.html structure
      // Since we might not have that modal, show a custom one
      injectBanner('#1976d2','&#129302; Please complete CAPTCHA #'+captchaCount+': Select all images containing <strong>'+type+'</strong>. Your previous selection was incorrect.');
    }

    function startBackwardsProgress() {
      var $bar=$('<div>').css({position:'fixed',top:'60px',right:'20px',width:'200px',background:'#fff',border:'1px solid #ddd',borderRadius:'8px',padding:'1em',zIndex:99995,boxShadow:'0 4px 16px rgba(0,0,0,.15)',fontSize:'.82em'});
      $bar.html('<strong>Transfer Processing</strong><div style="background:#eee;border-radius:4px;height:12px;margin:.5em 0;overflow:hidden;"><div id="prog-inner" style="background:#1976d2;height:100%;width:0%;transition:width .3s;"></div></div><div id="prog-pct">0%</div>');
      $('body').append($bar);
      var pct=0, dir=1;
      setInterval(function(){
        pct+=dir*(Math.random()*5+1);
        if(pct>=90 && Math.random()<0.4){ dir=-1*(Math.random()*3+1); }
        if(pct<=5){ dir=1; }
        pct=Math.max(0,Math.min(pct,90));
        $('#prog-inner').css('width',pct+'%');
        $('#prog-pct').text(Math.floor(pct)+'%...');
      },800);
    }

    function startAddressFail() {
      var fakeCities=['Old York','Fakesville','Scamtown','Error City','404 County','NullVille','Undefined Heights'];
      $('input[placeholder*="address"],input[placeholder*="city"],input[placeholder*="zip"],#wire-name').on('blur.addr', function(){
        if(Math.random()<0.7){
          $(this).val(fakeCities[Math.floor(Math.random()*fakeCities.length)]);
        }
      });
    }

    function startAdOverlay() {
      var ads=[
        'LIMITED TIME: Get rich quick with these 3 weird tricks! Bankers HATE him!',
        'CONGRATULATIONS! You are our 1,000,000th visitor! Click here to claim your prize!',
        '&#128512; Singles in your area want to meet you! Sign up FREE today!',
        'URGENT: Your computer may be infected! Call 1-800-NOTREAL immediately!',
      ];
      var idx=0;
      function showAd(){
        var $ad=$('<div>').css({
          position:'fixed', top:Math.random()*60+10+'%', left:Math.random()*50+10+'%',
          background:'#ff0', color:'#f00', border:'3px solid #f00', padding:'1em 1.5em',
          zIndex:99993, maxWidth:'300px', textAlign:'center', fontSize:'.88em',
          boxShadow:'0 0 20px rgba(255,0,0,.5)', borderRadius:'4px'
        }).html('<strong>&#127379; ADVERTISEMENT</strong><br/>'+ads[idx%ads.length]+'<br/><button onclick="this.parentNode.remove();" style="margin-top:.5em;background:#f00;color:#fff;border:none;padding:.3em .8em;cursor:pointer;">&#10005; Close</button>');
        $('body').append($ad);
        idx++;
      }
      showAd();
      setInterval(showAd, 8000);
    }

    function startDevToolsSpoof() {
      var opened=false;
      setInterval(function(){
        var t1=new Date();
        debugger;
        var t2=new Date();
        if((t2-t1)>100 && !opened){
          opened=true;
          injectBanner('#c0392b','&#128683; <strong>Security Alert:</strong> Unauthorized developer tools access detected. Session has been logged and flagged for fraud review. Reference: DEVTOOLS-'+Math.floor(100000+Math.random()*899999));
        }
      },2000);
    }

    function startBrokenKeys() {
      $('input').on('keypress.broken', function(e){
        if(e.key==='0'||e.key==='5'){ e.preventDefault(); }
      });
    }

    function startCursorTeleport() {
      $('#wire-submit').on('click.teleport', function(){
        // Can't move cursor in JS, but we can move the logout link visually
        var $logout=$('a[href="/logout"]').first();
        $logout.css({outline:'3px solid red',animation:'pulse 0.5s infinite'});
        setTimeout(function(){ $logout.css({outline:'',animation:''}); },3000);
      });
    }

    function startScrollLock() {
      // Block all scroll input entirely
      var savedPos = $(window).scrollTop();
      function lockScroll(e) {
        e.preventDefault();
        $(window).scrollTop(savedPos);
      }
      $(window).on('scroll.lock', function() {
        $(window).scrollTop(savedPos);
      });
      $(document).on('wheel.lock touchmove.lock keydown.lock', function(e) {
        var scrollKeys = {37:1, 38:1, 39:1, 40:1, 32:1, 33:1, 34:1, 35:1, 36:1};
        if (scrollKeys[e.which]) { e.preventDefault(); }
        if (e.type === 'wheel' || e.type === 'touchmove') { e.preventDefault(); }
      });
      $('body, html').css('overflow', 'hidden');
    }

    function startAlertSpam() {
      var msgs=[
        'SECURITY ALERT: New device login attempt blocked.',
        'Your session will expire in 30 seconds.',
        'Unusual activity detected on your account.',
        'Wire transfer limit reached for today.',
        'Identity verification required to continue.',
        'Your account has been temporarily restricted.',
        'New message from South Federal Security Team.',
        'IRS notification received — action required.',
        'Your W-9 form has expired.',
        'Suspicious login attempt from Nigeria blocked.',
      ];
      msgs.forEach(function(msg, i){
        setTimeout(function(){ injectBanner('#c0392b','&#128276; '+msg); }, i*600);
      });
    }

    function startMaintenanceMode() {
      var $overlay=$('#maintenanceOverlay');
      $overlay.css('display','flex');
      var totalSecs=14*3600+37*60+22;
      var timer=setInterval(function(){
        totalSecs--;
        if(totalSecs<=0){ clearInterval(timer); return; }
        var h=Math.floor(totalSecs/3600), m=Math.floor((totalSecs%3600)/60), s=totalSecs%60;
        $('#maint-timer').text(String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'));
      },1000);
    }

    function startSessionExpireBanner() {
      var $ban=$('<div>').css({
        position:'fixed',top:'0',left:'0',width:'100%',background:'#c0392b',color:'#fff',
        padding:'.5em 1em',textAlign:'center',fontSize:'.88em',zIndex:99999
      }).html('&#9201; <strong>Session expiring in <span id="ses-count">10</span> seconds.</strong> <a href="#" id="ses-extend" style="color:#ffe;">Extend session</a>');
      $('body').prepend($ban);
      var count=10;
      var timer=setInterval(function(){
        count--;
        $('#ses-count').text(count);
        if(count<=0){ clearInterval(timer); count=10; $('#ses-extend').trigger('click'); }
      },1000);
      $('#ses-extend').on('click', function(e){
        e.preventDefault(); clearInterval(timer); count=10; $('#ses-count').text(count);
        timer=setInterval(function(){
          count--; $('#ses-count').text(count);
          if(count<=0){ clearInterval(timer); count=10; $('#ses-extend').trigger('click'); }
        },1000);
      });
    }

    function startBalanceZero() {
      $('.accountRow h1').text('$0.00');
      $('.accountRow small').html('<span style="color:#c0392b;font-weight:600;">Balance liquidated &mdash; skill issue</span>');
      $('#nw-deposits,#nw-available').text('$0.00');
    }

    function startMatrix() {
      var $overlay=$('#matrixOverlay');
      $overlay.show();
      var canvas=$('#matrixCanvas')[0];
      canvas.width=window.innerWidth; canvas.height=window.innerHeight;
      var ctx=canvas.getContext('2d');
      var cols=Math.floor(window.innerWidth/14);
      var drops=[];
      for(var i=0;i<cols;i++){ drops[i]=Math.random()*window.innerHeight; }
      var chars='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';
      setInterval(function(){
        ctx.fillStyle='rgba(0,0,0,0.05)'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle='#0f0'; ctx.font='14px monospace';
        for(var i=0;i<drops.length;i++){
          ctx.fillText(chars[Math.floor(Math.random()*chars.length)], i*14, drops[i]);
          if(drops[i]>canvas.height && Math.random()>0.975){ drops[i]=0; }
          drops[i]+=14;
        }
      },50);
    }

    function injectScammerScore() {
      var $widget=$('<div>').css({
        background:'#fff',border:'2px solid #c0392b',borderRadius:'8px',
        padding:'1em',marginBottom:'1em',textAlign:'center'
      }).html(
        '<div style="font-size:.78em;color:#888;margin-bottom:.3em;">Fraud Risk Assessment</div>'+
        '<div style="font-size:2.4em;font-weight:700;color:#c0392b;">99<small style="font-size:.4em;">/100</small></div>'+
        '<div style="font-size:.75em;font-weight:600;color:#c0392b;margin-bottom:.5em;">HIGH RISK &#9650;</div>'+
        '<div style="background:#eee;border-radius:20px;height:8px;margin:.5em 0;overflow:hidden;">'+
        '<div style="width:99%;height:100%;background:linear-gradient(90deg,#ff9800,#c0392b);border-radius:20px;"></div></div>'+
        '<div style="font-size:.7em;color:#aaa;">Powered by FinCEN FraudIQ &reg; — Updated live</div>'
      );
      $('#security-widget').before($widget);
    }

    function startEmojiCursor() {
      var $emoji=$('<div>').css({
        position:'fixed',pointerEvents:'none',zIndex:999999,fontSize:'1.5em',lineHeight:'1',
        transform:'translate(-50%,-50%)'
      }).text('💩');
      $('body').append($emoji);
      $(document).on('mousemove.emoji', function(e){
        $emoji.css({left:e.clientX+'px',top:e.clientY+'px'});
      });
    }

    function startDeleteCountdown() {
      var secs=23*3600+59*60+59;
      var timer=setInterval(function(){
        secs--;
        if(secs<0){ clearInterval(timer); return; }
        var h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
        $('#delete-countdown').text(String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'));
      },1000);
    }

    } // end initTraps()

  } // end if verifyIdentityModal

  // ══════════════════════════════════════════════════════════
  // INACTIVITY POPUP
  // ══════════════════════════════════════════════════════════

  function triggerInactivePopup() { $('#inactivityPopup').fadeIn(); }
  window.triggerInactive = triggerInactivePopup;

  var inactivityTimer;
  function resetTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(triggerInactivePopup, 15 * 60 * 1000);
  }
  $(document).on('mousemove keypress click', resetTimer);
  resetTimer();

  // ══════════════════════════════════════════════════════════
  // UTILITY
  // ══════════════════════════════════════════════════════════

  function getRelativeDate(daysAhead) {
    var d = new Date();
    d.setDate(d.getDate() + daysAhead);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

});
