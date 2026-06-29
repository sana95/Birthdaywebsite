(function () {
  'use strict';

  // --- Lock Screen ---
  const lockScreen = document.getElementById('lock-screen');
  const mainContent = document.getElementById('main-content');
  const passwordInput = document.getElementById('password-input');
  const unlockBtn = document.getElementById('unlock-btn');
  const lockError = document.getElementById('lock-error');

  function validatePassword(input) {
    return input.toLowerCase().includes('moderation');
  }

  function attemptUnlock() {
    const value = passwordInput.value.trim();
    if (!value) return;

    if (validatePassword(value)) {
      lockScreen.classList.add('unlocked');
      showTicket();
    } else {
      lockError.hidden = false;
      passwordInput.classList.add('shake');
      passwordInput.addEventListener('animationend', () => {
        passwordInput.classList.remove('shake');
      }, { once: true });
    }
  }

  function showTicket() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Skip ticket animation if user prefers reduced motion
    if (prefersReducedMotion) {
      mainContent.hidden = false;
      mainContent.classList.add('visible');
      initJourney();
      return;
    }

    const ticketOverlay = document.getElementById('ticket-overlay');
    const ticketGreeting = document.getElementById('ticket-greeting');
    const trainTicket = document.getElementById('train-ticket');
    const ticketStamp = document.getElementById('ticket-stamp');

    // Show overlay
    ticketOverlay.setAttribute('aria-hidden', 'false');
    ticketOverlay.classList.add('visible');

    // Show greeting with handwriting reveal
    setTimeout(() => {
      ticketGreeting.classList.add('visible');
    }, 300);

    // Show ticket right as greeting finishes (1.5s + 300ms start)
    setTimeout(() => {
      trainTicket.style.opacity = '1';
      trainTicket.style.transform = 'translateY(0)';
    }, 1900);

    // Show VALIDATED stamp 700ms after ticket
    setTimeout(() => {
      ticketStamp.classList.add('visible');
    }, 2600);

    // Hold the full screen for 2s after stamp, then fade out
    setTimeout(() => {
      ticketOverlay.classList.add('fading-out');
      ticketOverlay.classList.remove('visible');

      // After fade-out transition completes (400ms), show main content
      setTimeout(() => {
        ticketOverlay.style.display = 'none';
        mainContent.hidden = false;
        initJourney();
        requestAnimationFrame(() => {
          mainContent.classList.add('visible');
        });
      }, 400);
    }, 4800);
  }

  unlockBtn.addEventListener('click', attemptUnlock);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptUnlock();
  });

  passwordInput.addEventListener('input', () => {
    if (!lockError.hidden) lockError.hidden = true;
  });

  // --- Journey State Machine ---
  function initJourney() {
    const scenes = [
      'scene-hero',
      'scene-stop-1',
      'scene-stop-2',
      'scene-stop-3',
      'scene-stop-4',
      'scene-stop-5',
      'scene-stop-6',
      'scene-letter'
    ];

    const stopIndices = [1, 2, 3, 4, 5, 6, 7];
    const totalStops = 7;

    const trainContainer = document.getElementById('train-container');
    const trainImg = document.getElementById('train-img');
    const journeyNav = document.getElementById('journey-nav');
    const navBack = document.getElementById('nav-back');
    const navForward = document.getElementById('nav-forward');
    const navTrackFilled = document.getElementById('nav-track-filled');
    const navTrainIcon = document.getElementById('nav-train-icon');
    const navStops = document.querySelectorAll('.nav-stop');
    const confettiContainer = document.getElementById('confetti-container');

    let currentIndex = 0;
    let transitioning = false;
    let confettiTriggered = false;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Split-Flap Board Animation ---
    startSplitFlap();

    showScene(0, false);
    updateNav();

    // Doledo row click is set up in startSplitFlap() after animation settles

    // Card arrows (left = back, right = forward)
    document.querySelectorAll('.card-arrow-right').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (transitioning) return;
        advance();
      });
    });

    document.querySelectorAll('.card-arrow-left').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (transitioning) return;
        goBack();
      });
    });

    // Navbar buttons
    navBack.addEventListener('click', () => {
      if (transitioning || currentIndex <= 0) return;
      goBack();
    });

    navForward.addEventListener('click', () => {
      if (transitioning || currentIndex >= scenes.length - 1) return;
      advance();
    });

    // Navbar stop dots — click to jump directly
    navStops.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        if (transitioning) return;
        const targetIndex = i + 1; // stops are 1-indexed in scenes array
        if (targetIndex === currentIndex) return;
        crossFade(targetIndex, targetIndex > currentIndex ? 'forward' : 'backward');
      });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (lockScreen.classList.contains('unlocked') === false) return;
      if (transitioning) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        advance();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goBack();
      }
    });

    // Touch/swipe support
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    mainContent.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    mainContent.addEventListener('touchend', (e) => {
      if (transitioning) return;
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;
      const minSwipe = 60;

      // Only trigger if horizontal movement is dominant
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
        if (dx < 0) {
          advance();
        } else {
          goBack();
        }
      }
    }

    function advance() {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= scenes.length) return;

      const needsTrain = stopIndices.includes(nextIndex);

      if (needsTrain && !prefersReducedMotion) {
        playTrainTransition(nextIndex, 'forward');
      } else {
        crossFade(nextIndex, 'forward');
      }
    }

    function goBack() {
      const prevIndex = currentIndex - 1;
      if (prevIndex < 0) return;

      // Going back never plays train — just cross-fade
      crossFade(prevIndex, 'backward');
    }

    function showScene(index, animate) {
      const allScenes = document.querySelectorAll('.scene');
      allScenes.forEach((s) => {
        s.classList.remove('active', 'exiting', 'entering-back');
      });

      const target = document.getElementById(scenes[index]);
      if (target) {
        if (animate) {
          requestAnimationFrame(() => {
            target.classList.add('active');
          });
        } else {
          target.classList.add('active');
        }
      }
      currentIndex = index;
      updateNav();

      // Set up envelope interaction when letter scene is shown
      if (scenes[index] === 'scene-letter' && !confettiTriggered) {
        initEnvelope();
      }
    }

    function updateNav() {
      // Show nav once past hero
      journeyNav.hidden = currentIndex <= 0;

      // Disable back on first stop
      navBack.disabled = currentIndex <= 0;
      // Disable forward on last scene
      navForward.disabled = currentIndex >= scenes.length - 1;

      // Update track progress (stops 1-7 map to indices 1-7)
      let trackProgress = 0;
      if (currentIndex >= 1 && currentIndex <= 7) {
        trackProgress = (currentIndex - 1) / (totalStops - 1);
      } else if (currentIndex > 7) {
        trackProgress = 1; // past all stops
      }

      const percent = trackProgress * 100;
      navTrackFilled.style.width = percent + '%';
      navTrainIcon.style.left = percent + '%';

      // Update stop dots
      navStops.forEach((dot, i) => {
        const stopNum = i + 1; // stops are 1-indexed
        dot.classList.remove('visited', 'current');
        if (stopNum < currentIndex || (currentIndex > 7)) {
          dot.classList.add('visited');
        } else if (stopNum === currentIndex) {
          dot.classList.add('visited', 'current');
        }
      });
    }

    function crossFade(nextIndex, direction) {
      transitioning = true;
      const currentScene = document.getElementById(scenes[currentIndex]);

      if (currentScene) {
        currentScene.classList.add('exiting');
        currentScene.classList.remove('active');
      }

      setTimeout(() => {
        if (currentScene) {
          currentScene.classList.remove('exiting');
        }
        showScene(nextIndex, true);
        transitioning = false;
      }, 400);
    }

    function playTrainTransition(nextIndex, direction) {
      transitioning = true;
      const currentScene = document.getElementById(scenes[currentIndex]);
      const isArrival = nextIndex === 7;

      // Fade out current scene
      if (currentScene) {
        currentScene.classList.add('exiting');
        currentScene.classList.remove('active');
      }

      // After current fades out (~250ms), show train
      setTimeout(() => {
        if (currentScene) {
          currentScene.classList.remove('exiting');
        }

        // Fully reset train state
        trainContainer.classList.remove('active', 'arriving');
        trainImg.style.animation = 'none';
        trainImg.style.transform = 'translateX(calc(-100% - 10px)) scaleX(-1)';

        // Force reflow to reset animation
        void trainImg.offsetHeight;

        // Clear inline styles so CSS animation takes over
        trainImg.style.animation = '';
        trainImg.style.transform = '';

        // Activate train
        if (isArrival) {
          trainContainer.classList.add('active', 'arriving');
        } else {
          trainContainer.classList.add('active');
        }

        // Hide container the instant the train image animation ends
        function onAnimEnd(e) {
          // Only respond to the train-img's own animation, not bubbled events
          if (e.target !== trainImg) return;
          trainImg.removeEventListener('animationend', onAnimEnd);

          if (isArrival) {
            // Arrival: train stops in center, pause briefly then reveal card
            setTimeout(() => {
              trainContainer.classList.remove('active', 'arriving');
              trainImg.style.visibility = 'hidden';
              trainImg.style.transform = 'translateX(calc(-100% - 10px)) scaleX(-1)';
              showScene(nextIndex, true);
              transitioning = false;
              trainImg.style.visibility = '';
            }, 500);
          } else {
            // Normal crossing: instant hide and show next
            trainContainer.classList.remove('active', 'arriving');
            trainImg.style.visibility = 'hidden';
            trainImg.style.transform = 'translateX(calc(-100% - 10px)) scaleX(-1)';
            showScene(nextIndex, true);
            transitioning = false;
            trainImg.style.visibility = '';
          }
        }

        trainImg.addEventListener('animationend', onAnimEnd);
      }, 250);
    }

    // --- Departure Board ---
    function startSplitFlap() {
      const container = document.getElementById('departure-rows');
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

      // Calculate times based on current system time
      const now = new Date();
      function formatTime(date) {
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        return h + ':' + m;
      }

      function offsetTime(hoursOffset) {
        const d = new Date(now.getTime() + hoursOffset * 60 * 60 * 1000);
        return formatTime(d);
      }

      const rows = [
        { time: formatTime(now), destination: 'DOLEDO EXPRESS', status: 'NOW BOARDING', statusClass: 'status-now-boarding', animated: true },
        { time: offsetTime(-2), destination: 'CHICAGO EXPRESS', status: 'SCHEDULED', statusClass: 'status-arrived' },
        { time: offsetTime(1), destination: 'SEATTLE COAST', status: 'ON TIME', statusClass: 'status-on-time' },
        { time: offsetTime(1.5), destination: 'LOS ANGELES', status: 'CANCELLED', statusClass: 'status-cancelled' },
        { time: offsetTime(3), destination: 'WISCONSIN LINE', status: 'ON TIME', statusClass: 'status-on-time' }
      ];

      container.innerHTML = '';

      rows.forEach(function(rowData) {
        const row = document.createElement('div');
        row.className = 'departure-row';
        if (rowData.animated) row.setAttribute('data-doledo', 'true');

        const timeEl = document.createElement('span');
        timeEl.className = 'departure-row-time';

        const destEl = document.createElement('span');
        destEl.className = 'departure-row-destination';

        const statusEl = document.createElement('span');
        statusEl.className = 'departure-row-status';

        if (rowData.animated) {
          // Start with random characters
          function randStr(len) {
            var s = '';
            for (var j = 0; j < len; j++) s += chars[Math.floor(Math.random() * chars.length)];
            return s;
          }
          timeEl.textContent = randStr(2) + ':' + randStr(2);
          destEl.textContent = randStr(14);
          statusEl.textContent = randStr(11);
        } else {
          timeEl.textContent = rowData.time;
          destEl.textContent = rowData.destination;
          statusEl.textContent = rowData.status;
          statusEl.classList.add(rowData.statusClass);
        }

        row.appendChild(timeEl);
        row.appendChild(destEl);
        row.appendChild(statusEl);
        container.appendChild(row);
      });

      // If reduced motion, show final state immediately
      if (prefersReducedMotion) {
        const doledoRow = container.querySelector('[data-doledo]');
        if (doledoRow) {
          const timeEl = doledoRow.querySelector('.departure-row-time');
          const destEl = doledoRow.querySelector('.departure-row-destination');
          const statusEl = doledoRow.querySelector('.departure-row-status');
          timeEl.textContent = formatTime(now);
          destEl.textContent = 'DOLEDO EXPRESS';
          statusEl.textContent = 'NOW BOARDING';
          statusEl.classList.add('status-now-boarding');
          doledoRow.classList.add('doledo-highlight');
          doledoRow.classList.add('doledo-clickable');

          doledoRow.addEventListener('click', function handleDepart() {
            doledoRow.removeEventListener('click', handleDepart);
            doledoRow.classList.remove('doledo-clickable');
            statusEl.className = 'departure-row-status status-departed';
            statusEl.textContent = 'DEPARTED';
            setTimeout(function() { advance(); }, 800);
          });
        }
        return;
      }

      // Animate the Doledo row
      const doledoRow = container.querySelector('[data-doledo]');
      const timeEl = doledoRow.querySelector('.departure-row-time');
      const destEl = doledoRow.querySelector('.departure-row-destination');
      const statusEl = doledoRow.querySelector('.departure-row-status');

      const finalTime = formatTime(now);
      const finalDest = 'DOLEDO EXPRESS';
      const finalStatus = 'NOW BOARDING';

      // Convert text fields to individual character spans
      function createCharSpans(el, text) {
        el.innerHTML = '';
        var spans = [];
        for (var i = 0; i < text.length; i++) {
          var span = document.createElement('span');
          span.className = 'flip-char';
          span.textContent = text[i] === ' ' ? ' ' : (chars[Math.floor(Math.random() * chars.length)]);
          el.appendChild(span);
          spans.push({ el: span, target: text[i] });
        }
        return spans;
      }

      // Start flipping after 1 second delay
      setTimeout(function() {
        var timeSpans = createCharSpans(timeEl, finalTime);
        var destSpans = createCharSpans(destEl, finalDest);
        var statusSpans = createCharSpans(statusEl, finalStatus);

        var allGroups = [
          { spans: timeSpans, delay: 0 },
          { spans: destSpans, delay: 100 },
          { spans: statusSpans, delay: 300 }
        ];

        var groupsDone = 0;
        var totalGroups = allGroups.length;

        allGroups.forEach(function(group) {
          animateCharGroup(group.spans, group.delay, function() {
            groupsDone++;
            if (groupsDone === totalGroups) {
              // All done - highlight the row and make it clickable
              doledoRow.classList.add('doledo-highlight');
              doledoRow.classList.add('doledo-clickable');
              statusEl.classList.add('status-now-boarding');

              doledoRow.addEventListener('click', function handleDepart() {
                doledoRow.removeEventListener('click', handleDepart);
                doledoRow.classList.remove('doledo-clickable');

                // Flip status to DEPARTED with character animation
                var targetText = 'DEPARTED';
                var currentText = statusEl.textContent;
                statusEl.innerHTML = '';
                statusEl.className = 'departure-row-status status-departed';

                // Pad to target length
                var maxLen = Math.max(currentText.length, targetText.length);
                var spans = [];
                for (var i = 0; i < maxLen; i++) {
                  var span = document.createElement('span');
                  span.className = 'flip-char';
                  span.textContent = i < currentText.length ? currentText[i] : ' ';
                  statusEl.appendChild(span);
                  spans.push({ el: span, target: i < targetText.length ? targetText[i] : ' ' });
                }

                // Flip each character with stagger
                var settled = 0;
                spans.forEach(function(s, idx) {
                  var stagger = idx * 50;
                  var flipDuration = 400 + Math.random() * 200;
                  var flipInterval = 50;
                  var elapsed = 0;

                  setTimeout(function() {
                    var interval = setInterval(function() {
                      elapsed += flipInterval;
                      s.el.textContent = chars[Math.floor(Math.random() * chars.length)];
                      s.el.classList.add('flipping');
                      setTimeout(function() { s.el.classList.remove('flipping'); }, 30);

                      if (elapsed >= flipDuration) {
                        clearInterval(interval);
                        s.el.textContent = s.target;
                        s.el.classList.add('settled');
                        settled++;
                        if (settled === spans.length) {
                          // All settled — trigger advance
                          setTimeout(function() { advance(); }, 600);
                        }
                      }
                    }, flipInterval);
                  }, stagger);
                });
              });
            }
          });
        });
      }, 1000);

      function animateCharGroup(spans, baseDelay, onComplete) {
        var settled = 0;
        spans.forEach(function(s, i) {
          if (s.target === ' ' || s.target === ':') {
            // Non-letter chars settle immediately
            s.el.textContent = s.target === ' ' ? ' ' : s.target;
            s.el.classList.add('settled');
            settled++;
            if (settled === spans.length && onComplete) onComplete();
            return;
          }

          var stagger = i * 40;
          var flipDuration = 1000 + Math.random() * 600;
          var flipInterval = 60;
          var elapsed = 0;

          setTimeout(function() {
            var interval = setInterval(function() {
              elapsed += flipInterval;
              s.el.textContent = chars[Math.floor(Math.random() * chars.length)];
              s.el.classList.add('flipping');
              setTimeout(function() {
                s.el.classList.remove('flipping');
              }, 40);

              if (elapsed >= flipDuration) {
                clearInterval(interval);
                s.el.textContent = s.target;
                s.el.classList.add('settled');
                settled++;
                if (settled === spans.length && onComplete) onComplete();
              }
            }, flipInterval);
          }, baseDelay + stagger);
        });
      }
    }

    // Envelope interaction
    function initEnvelope() {
      const envelopeWrapper = document.getElementById('envelope-wrapper');
      const envelope = document.getElementById('envelope');
      const letterContainer = document.getElementById('letter-container');

      if (!envelope || !envelopeWrapper || !letterContainer) return;

      function openEnvelope() {
        envelope.removeEventListener('click', openEnvelope);
        envelope.removeEventListener('keydown', onEnvelopeKey);

        // Start opening animation
        envelopeWrapper.classList.add('opening');

        if (prefersReducedMotion) {
          // Skip animation, show letter immediately
          envelopeWrapper.classList.add('opened');
          letterContainer.setAttribute('aria-hidden', 'false');
          letterContainer.classList.add('revealed');
          confettiTriggered = true;
          triggerConfetti();
          // Mark all nav stops as visited
          navStops.forEach((dot) => dot.classList.add('visited'));
        } else {
          // After card fades out (seal 0.3s + card 0.5s with 0.2s delay = ~0.7s)
          setTimeout(function() {
            envelopeWrapper.classList.add('opened');
            letterContainer.setAttribute('aria-hidden', 'false');
            letterContainer.classList.add('revealed');

            // After letter slides in (0.6s transition), trigger confetti
            setTimeout(function() {
              confettiTriggered = true;
              triggerConfetti();
              // Mark all nav stops as visited
              navStops.forEach((dot) => dot.classList.add('visited'));
            }, 600);
          }, 600);
        }
      }

      function onEnvelopeKey(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEnvelope();
        }
      }

      envelope.addEventListener('click', openEnvelope);
      envelope.addEventListener('keydown', onEnvelopeKey);
    }

    // Confetti
    function triggerConfetti() {
      if (prefersReducedMotion) return;

      const colors = ['#C4A96A', '#D4C08A', '#E8D5A3', '#3D4F5F', '#9AABB8', '#F0E6CC', '#B89A5C'];
      const shapes = ['circle', 'square', 'strip'];

      for (let i = 0; i < 80; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';

        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 8 + 5;

        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = color;
        piece.style.animationDuration = (Math.random() * 2 + 2.5) + 's';
        piece.style.animationDelay = (Math.random() * 1.5) + 's';

        if (shape === 'circle') {
          piece.style.width = size + 'px';
          piece.style.height = size + 'px';
          piece.style.borderRadius = '50%';
        } else if (shape === 'square') {
          piece.style.width = size + 'px';
          piece.style.height = size + 'px';
          piece.style.borderRadius = '2px';
        } else {
          piece.style.width = (size * 0.4) + 'px';
          piece.style.height = (size * 1.5) + 'px';
          piece.style.borderRadius = '1px';
        }

        confettiContainer.appendChild(piece);
      }

      setTimeout(() => {
        confettiContainer.innerHTML = '';
      }, 6000);
    }
  }
})();
