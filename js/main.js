/* ==========================================================================
   main.js : the one JavaScript file shared by every page of the site.

   It is loaded with a <script> tag at the very bottom of <body>. By the time
   the browser reaches that tag, all the HTML above it already exists, so
   document.getElementById() and friends can find every element safely.

   Every feature below first checks that its elements exist on the current
   page (for example: if (dialog) {...}). That is what lets one file serve
   five different pages: features whose HTML is missing simply switch off.

   Contents
     0. Setup: the reduced-motion preference
     1. Safe storage helpers (sessionStorage)
     2. Navigation: background on scroll + mobile menu
     3. Background music: toggle, first-visit popup, remembering the song
     4. Scroll reveal (Intersection Observer)
     5. Word rotate (hero line)
     6. Bento cards: pointer-following glow
     7. Footer year
     8. Projects page: filter buttons and plan popup
     9. Academic planner: add, complete and delete tasks
     10. Contact form: validation and sending
   ========================================================================== */


/* --------------------------------------------------------------------------
   0. SETUP: THE REDUCED-MOTION PREFERENCE
   window.matchMedia() lets JavaScript ask the same questions CSS media
   queries ask. Some visitors switch on "reduce motion" in their phone or
   computer settings (movement can cause dizziness or distraction). When
   .matches is true we skip the purely decorative movement, such as the
   rotating hero word. CSS handles its own half of this in style.css.
   -------------------------------------------------------------------------- */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* --------------------------------------------------------------------------
   1. SAFE STORAGE HELPERS
   sessionStorage stores small pieces of text for as long as this browser tab
   stays open, and forgets them when the tab closes. That is exactly what
   "show the popup once per session" needs.

   Some browsers (private windows, strict privacy settings) throw an error
   the moment storage is touched. Wrapping each call in try...catch means an
   error is caught and ignored: the site keeps working, it just cannot
   remember anything. The two helpers live inside one object, "store", so
   the rest of the file can write store.get('key') and store.set('key', 'value').
   -------------------------------------------------------------------------- */
const store = {
  get(key) {
    try {
      return sessionStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {
      // Storage is unavailable. Nothing to do: the feature still works for this page view.
    }
  }
};


/* --------------------------------------------------------------------------
   2. NAVIGATION
   -------------------------------------------------------------------------- */
const header = document.getElementById('site-header');
const menuButton = document.getElementById('menu-btn');
const navLinks = document.getElementById('nav-links');

// NAV BACKGROUND ON SCROLL: the nav starts transparent so the hero shows
// through it. Once the page has scrolled more than 24px, we add the class
// .is-scrolled and CSS fades in a solid background behind the links.
// classList.toggle(name, condition) adds the class when the condition is
// true and removes it when false, so one line handles both directions.
function updateHeaderOnScroll() {
  header.classList.toggle('is-scrolled', window.scrollY > 24);
}

if (header) {
  updateHeaderOnScroll(); // run once on load, in case the page opens already scrolled (e.g. after a refresh)
  // { passive: true } promises the browser we will never block scrolling,
  // which lets it keep scrolling smooth while our function runs.
  window.addEventListener('scroll', updateHeaderOnScroll, { passive: true });
}

// MOBILE MENU: below 768px the links hide behind a menu button.
// aria-expanded tells screen readers whether the menu is open. We read it
// to know the current state and write it back to change the state, so the
// HTML attribute is the single source of truth.
function setMenuOpen(isOpen) {
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  header.classList.toggle('is-menu-open', isOpen);
  document.body.classList.toggle('is-locked', isOpen); // stops the page scrolling behind the open menu
}

if (header && menuButton && navLinks) {
  // Click on the button: flip between open and closed.
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    setMenuOpen(!isOpen);
  });

  // EVENT DELEGATION: instead of adding a listener to every link, one
  // listener on the list catches clicks that "bubble up" from any link.
  // closest('a') checks whether the click happened on (or inside) a link.
  navLinks.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      setMenuOpen(false);
    }
  });

  // The Escape key closes the menu and returns keyboard focus to the button,
  // so keyboard users are not left stranded somewhere on the page.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.classList.contains('is-menu-open')) {
      setMenuOpen(false);
      menuButton.focus();
    }
  });

  // If the window is widened past the mobile breakpoint while the menu is
  // open, close it so the desktop layout does not inherit a locked page.
  window.matchMedia('(min-width: 769px)').addEventListener('change', (event) => {
    if (event.matches) {
      setMenuOpen(false);
    }
  });
}


/* --------------------------------------------------------------------------
   3. BACKGROUND MUSIC
   The song lives in one <audio> element on every page. Because each page is
   a separate HTML file, the song would normally restart from zero every time
   the visitor clicks a link. To make it feel continuous we save three facts
   in sessionStorage:
     MUSIC_KEY  'on' or 'off', the visitor's choice
     TIME_KEY   how many seconds into the song we were
     ASKED_KEY  '1' once the popup has been shown this session
   -------------------------------------------------------------------------- */
const audio = document.getElementById('bg-audio');
const musicToggle = document.getElementById('music-toggle');
const musicDialog = document.getElementById('music-dialog'); // only exists on index.html

const MUSIC_KEY = 'eod-music';
const TIME_KEY = 'eod-music-time';
const ASKED_KEY = 'eod-music-asked';

// Updates the music button to match reality. aria-pressed="true" is how a
// toggle button tells screen readers it is switched on; the CSS also uses
// the .is-playing class to start the little equaliser bars moving.
function setToggleState(isPlaying) {
  if (!musicToggle) return;
  musicToggle.setAttribute('aria-pressed', String(isPlaying));
  musicToggle.classList.toggle('is-playing', isPlaying);
}

// BROWSER AUTOPLAY RULES: browsers refuse to start sound until the visitor
// has interacted with the page (a click, tap or key press). audio.play()
// returns a Promise: .then() runs if the song started, .catch() runs if
// the browser blocked it. When blocked, we wait for the first interaction
// and try again, so the song picks up as soon as the visitor touches the page.
function playMusic() {
  if (!audio) return;
  audio.volume = 0.5; // half volume: background music should sit under the page, not over it
  const playRequest = audio.play();

  // The song can take a moment to download before it is heard. If the browser
  // accepted the request, audio.paused is already false, so we show "on" right
  // away instead of making the visitor wait. (A blocked request leaves it true.)
  setToggleState(!audio.paused);

  playRequest
    .then(() => {
      setToggleState(true);
    })
    .catch(() => {
      setToggleState(false);
      waitForFirstInteraction();
    });
}

function pauseMusic() {
  audio.pause();
  setToggleState(false);
  store.set(MUSIC_KEY, 'off');
}

// Listens for the visitor's first click, tap or key press anywhere on the
// page, then resumes the song if they had chosen "on". Clicks on the music
// button itself are ignored here, because that button has its own handler.
function waitForFirstInteraction() {
  function resume(event) {
    if (event.target.closest && event.target.closest('#music-toggle')) return;
    document.removeEventListener('pointerdown', resume);
    document.removeEventListener('keydown', resume);
    if (store.get(MUSIC_KEY) === 'on') {
      playMusic();
    }
  }
  document.addEventListener('pointerdown', resume);
  document.addEventListener('keydown', resume);
}

if (audio && musicToggle) {
  // RESTORE THE POSITION: once the browser knows the song's length
  // ('loadedmetadata'), jump to where the previous page left off.
  // { once: true } removes the listener automatically after it runs.
  const savedTime = parseFloat(store.get(TIME_KEY));
  if (!Number.isNaN(savedTime)) {
    audio.addEventListener('loadedmetadata', () => {
      audio.currentTime = savedTime;
    }, { once: true });
  }

  // SAVE THE POSITION: 'timeupdate' fires a few times per second while the
  // song plays; 'pagehide' fires as the visitor leaves for another page.
  audio.addEventListener('timeupdate', () => {
    store.set(TIME_KEY, String(audio.currentTime));
  });
  window.addEventListener('pagehide', () => {
    store.set(TIME_KEY, String(audio.currentTime));
  });

  // THE TOGGLE BUTTON (present on every page): play if paused, pause if playing.
  musicToggle.addEventListener('click', () => {
    if (audio.paused) {
      store.set(MUSIC_KEY, 'on');
      playMusic();
    } else {
      pauseMusic();
    }
  });

  // Carry the choice across pages: if the visitor turned music on earlier
  // in this session, try to continue it on this page too.
  if (store.get(MUSIC_KEY) === 'on') {
    playMusic();
  }
}

// CLOSING A POPUP WITH AN ANIMATION (used by both popups on the site).
// The function takes the dialog element as a PARAMETER, so the same code can
// close the music popup on the homepage and the plan popup on Projects.
function closeDialog(dialog) {
  // Add the closing class so CSS plays the exit animation, then wait for
  // every running animation on the dialog to finish before really closing it.
  // getAnimations() returns those animations; Promise.all waits for them all.
  // If there are none (e.g. animations disabled), it resolves straight away.
  dialog.classList.add('is-closing');
  const animationsDone = Promise.all(dialog.getAnimations().map((animation) => animation.finished));

  // SAFETY NET: a timer that resolves after 400ms. Promise.race settles with
  // whichever finishes first, so even if the browser pauses the animation
  // (for example in a background tab) the popup still closes.
  const safetyTimer = new Promise((resolve) => window.setTimeout(resolve, 400));

  Promise.race([animationsDone, safetyTimer]).then(() => {
    if (!dialog.open) return; // already closed, nothing to do
    dialog.classList.remove('is-closing');
    dialog.close();
  });
}

// THE FIRST-VISIT POPUP (home page only). <dialog> is a built-in HTML
// element for popups: showModal() opens it on top of the page, makes the
// page behind it unclickable, moves keyboard focus into it, and lets the
// Escape key close it. We only open it if ASKED_KEY has not been set yet,
// which is what limits it to once per browser session.
function handleMusicChoice(choice) {
  store.set(ASKED_KEY, '1');
  store.set(MUSIC_KEY, choice);
  if (choice === 'on') {
    playMusic(); // called straight from a click, so the browser allows the sound
  }
  closeDialog(musicDialog);
}

if (musicDialog && audio && typeof musicDialog.showModal === 'function') {
  // Both buttons carry data-music-choice="on" or "off". One listener on the
  // dialog reads that attribute from whichever button was clicked.
  musicDialog.addEventListener('click', (event) => {
    const button = event.target.closest('[data-music-choice]');
    if (button) {
      handleMusicChoice(button.dataset.musicChoice);
    }
  });

  // Pressing Escape fires 'cancel'. preventDefault() stops the instant
  // close so our animated close runs instead, and Escape counts as "keep it off".
  musicDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    handleMusicChoice('off');
  });

  // Open the popup shortly after load, so the hero's entrance plays first.
  if (!store.get(ASKED_KEY)) {
    window.setTimeout(() => {
      musicDialog.showModal();
    }, 1200);
  }
}


/* --------------------------------------------------------------------------
   4. SCROLL REVEAL (INTERSECTION OBSERVER)
   An IntersectionObserver watches elements and tells us when they scroll
   into view, without us having to check positions on every scroll event.
   When an element with .reveal becomes 10% visible (threshold: 0.1) we add
   .revealed, and the CSS transition fades and lifts it into place.
   unobserve() stops watching it afterwards, so each reveal happens once.
   rootMargin shrinks the bottom of the viewport by 8%, so the reveal starts
   a little after the element peeks in, when the reader can actually see it.
   -------------------------------------------------------------------------- */
const revealItems = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  // Very old browsers without IntersectionObserver: just show everything.
  revealItems.forEach((item) => item.classList.add('revealed'));
}


/* --------------------------------------------------------------------------
   5. WORD ROTATE (ported from Magic UI's "Word Rotate" on 21st.dev)
   The original is a React component. Here the words come from a
   data-words attribute in the HTML, split into an ARRAY with split('|').
   Every 2.5 seconds the current word slides down and fades out, the text is
   swapped, and the next word drops in from above.

   The movement uses the Web Animations API: element.animate(keyframes,
   options) runs a CSS-quality animation from JavaScript. .finished is a
   Promise that resolves when the animation ends, which is how we know when
   to swap the text. Only transform and opacity move: those two properties
   can animate on the graphics card without recalculating the page layout.

   After two full cycles it stops on the first word, so the hero settles down
   instead of moving forever while someone is reading.
   -------------------------------------------------------------------------- */
const rotator = document.querySelector('[data-words]');

if (rotator && !prefersReducedMotion) {
  const words = rotator.dataset.words.split('|');
  const wordElement = rotator.querySelector('.word-rotate__word');
  const easeOut = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const totalSwaps = words.length * 2; // two full cycles, ending back on words[0]
  let index = 0;
  let swaps = 0;

  function showNextWord() {
    index = (index + 1) % words.length; // % (remainder) wraps the index back to 0 after the last word

    const leave = wordElement.animate(
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(45%)' }
      ],
      { duration: 200, easing: easeOut, fill: 'forwards' }
    );

    leave.finished.then(() => {
      wordElement.textContent = words[index];
      wordElement.animate(
        [
          { opacity: 0, transform: 'translateY(-45%)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        { duration: 260, easing: easeOut, fill: 'forwards' }
      );
    });

    swaps += 1;
    if (swaps >= totalSwaps) {
      window.clearInterval(rotateTimer);
    }
  }

  // setInterval calls showNextWord every 2500 milliseconds until cleared.
  const rotateTimer = window.setInterval(showNextWord, 2500);
}


/* --------------------------------------------------------------------------
   6. BENTO CARDS: POINTER-FOLLOWING GLOW
   (ported from Magic UI's "Magic Card", orb mode, on 21st.dev)
   Each card holds an empty .bento-card__glow element: a soft circle of light.
   As the pointer moves over a card we move the circle to the pointer.
   getBoundingClientRect() gives the card's position on screen, so
   pointer position minus card position = pointer position inside the card.
   We move it with transform (not left/top) because transform does not
   force the browser to recalculate the layout of the page.

   It only runs for a real mouse or trackpad ("hover: hover" and
   "pointer: fine"). On touch screens there is no hovering pointer to follow.
   -------------------------------------------------------------------------- */
const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

if (canHover) {
  document.querySelectorAll('.bento-card').forEach((card) => {
    const glow = card.querySelector('.bento-card__glow');
    if (!glow) return;

    card.addEventListener('pointermove', (event) => {
      const box = card.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      glow.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    });
  });
}


/* --------------------------------------------------------------------------
   7. FOOTER YEAR
   Any element with a data-year attribute gets the current year written into
   it, so the copyright line never goes out of date.
   -------------------------------------------------------------------------- */
document.querySelectorAll('[data-year]').forEach((element) => {
  element.textContent = new Date().getFullYear();
});


/* --------------------------------------------------------------------------
   8. PROJECTS PAGE: FILTER BUTTONS AND PLAN POPUP
   -------------------------------------------------------------------------- */
const projectGrid = document.getElementById('project-grid');

if (projectGrid) {
  const filterButtons = document.querySelectorAll('[data-filter]');
  const projectCount = document.getElementById('project-count');

  // querySelectorAll returns a NodeList. Array.from() turns it into a real
  // ARRAY, so we can use array methods such as .filter() and .includes().
  const projectCards = Array.from(projectGrid.querySelectorAll('.project-card'));

  // FILTERING: keep the cards whose data-status matches the chosen filter
  // ("all" keeps every card), hide the rest with the hidden attribute, mark
  // the chosen button as pressed, and update the "Showing ..." message.
  function filterProjects(filter) {
    const visibleCards = projectCards.filter((card) => filter === 'all' || card.dataset.status === filter);

    projectCards.forEach((card) => {
      const shouldShow = visibleCards.includes(card);
      const wasHidden = card.hidden;
      card.hidden = !shouldShow;

      // A card that is appearing again fades up into place (CSS class
      // .is-entering). The class is removed when the animation ends, so it
      // can play again next time.
      if (shouldShow && wasHidden) {
        card.classList.add('is-entering');
        card.addEventListener('animationend', () => card.classList.remove('is-entering'), { once: true });
      }
    });

    filterButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    });

    // A TEMPLATE LITERAL (text in backticks) can drop values in with ${...}.
    // The ternary operator (condition ? a : b) picks "project" or "projects".
    const count = visibleCards.length;
    const noun = count === 1 ? 'project' : 'projects';
    if (filter === 'all') {
      projectCount.textContent = `Showing all ${count} ${noun}`;
    } else {
      projectCount.textContent = `Showing ${count} ${filter === 'live' ? 'live' : 'concept'} ${noun}`;
    }
  }

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => filterProjects(button.dataset.filter));
  });

  // THE PLAN POPUP. Each concept card has a "Read the plan" button with
  // data-plan="plan-something", naming the <template> that holds its plan.
  const planDialog = document.getElementById('plan-dialog');
  const planBody = document.getElementById('plan-dialog-body');
  const planTitle = document.getElementById('plan-title');

  if (planDialog && typeof planDialog.showModal === 'function') {
    // One listener on the whole grid (event delegation) handles every button.
    projectGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-plan]');
      if (!button) return;

      // template.content is the template's hidden contents. cloneNode(true)
      // copies it, and replaceChildren() swaps the popup's old plan for the new one.
      const template = document.getElementById(button.dataset.plan);
      planBody.replaceChildren(template.content.cloneNode(true));

      // The heading takes the project's name from the card the button sits in.
      planTitle.textContent = button.closest('.project').querySelector('.card-title').textContent;
      planDialog.showModal();
    });

    // Close on the close button, or on a click outside the popup's box
    // (on the dimmed backdrop). getBoundingClientRect() gives the box's edges.
    planDialog.addEventListener('click', (event) => {
      const box = planDialog.getBoundingClientRect();
      const clickedOutside =
        event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom;

      if (event.target.closest('[data-close-dialog]') || clickedOutside) {
        closeDialog(planDialog);
      }
    });

    // Escape: run our animated close instead of the instant one.
    planDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog(planDialog);
    });
  }
}


/* --------------------------------------------------------------------------
   9. ACADEMIC PLANNER: ADD, COMPLETE AND DELETE TASKS
   The tasks live in an ARRAY of OBJECTS, one object per task:
     { id: 'k3x9a', title: 'Read chapter 2', course: 'COS 106', due: '2026-10-21', done: false }
   The page never edits the list on screen directly. Instead, every action
   changes the array, saves it, and redraws the list from the array. Keeping
   one "source of truth" makes the code simpler and avoids the screen and the
   data disagreeing.

   localStorage (unlike sessionStorage) keeps data after the browser closes,
   so the tasks are still there next week, on this device and browser.
   It only stores text, so the array is turned into text with JSON.stringify()
   when saving, and back into an array with JSON.parse() when loading.
   -------------------------------------------------------------------------- */
const taskForm = document.getElementById('task-form');
const taskList = document.getElementById('task-list');

if (taskForm && taskList) {
  const TASKS_KEY = 'eod-planner-tasks';

  const titleInput = document.getElementById('task-title');
  const courseInput = document.getElementById('task-course');
  const dueInput = document.getElementById('task-due');
  const titleError = document.getElementById('task-title-error');
  const taskTemplate = document.getElementById('task-template');
  const emptyMessage = document.getElementById('task-empty');
  const countText = document.getElementById('task-count');
  const progressBar = document.getElementById('task-progress');
  const clearButton = document.getElementById('clear-done');
  const statusText = document.getElementById('task-status');
  const listHeading = document.getElementById('task-list-title');
  const taskFilterButtons = document.querySelectorAll('[data-task-filter]');

  // tabindex="-1" lets a heading receive focus from JavaScript (but not from
  // the Tab key). We use it to park focus somewhere sensible after a clear-up.
  listHeading.setAttribute('tabindex', '-1');

  let currentFilter = 'all';   // 'all', 'todo' or 'done'

  // A short unique id for each task: the time in base 36 plus random letters.
  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // LOAD: read the saved tasks. On the very first visit there is nothing
  // saved yet (null), so we start with one example task. If anything goes
  // wrong (storage blocked, damaged data) we start with an empty array.
  function loadTasks() {
    try {
      const saved = localStorage.getItem(TASKS_KEY);
      if (saved === null) {
        return [{ id: makeId(), title: 'Submit the COS 106 portfolio', course: 'COS 106', due: '', done: false }];
      }
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  // SAVE: write the whole array back as text.
  function saveTasks() {
    try {
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    } catch (error) {
      // Storage unavailable: the planner still works until the page is closed.
    }
  }

  let tasks = loadTasks();

  // Writes a message into the hidden live region for screen readers.
  function announce(message) {
    statusText.textContent = message;
  }

  // DATES: the date box gives text like "2026-10-21". We split it into
  // numbers and build a Date from the parts (months count from 0 in
  // JavaScript, hence month - 1). Building it this way keeps the local date,
  // where new Date('2026-10-21') would be read as midnight in London time.
  function toDate(isoText) {
    const [year, month, day] = isoText.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDue(isoText) {
    return toDate(isoText).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // A task is overdue if it has a due date, is not done, and the date is before today.
  function isOverdue(task) {
    if (!task.due || task.done) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);   // compare dates only, not times
    return toDate(task.due) < today;
  }

  // BUILD ONE ROW: copy the <template>, then fill it in for this task.
  // textContent (never innerHTML) is used for anything the visitor typed, so
  // text that looks like HTML is shown as plain text and can never run as code.
  function buildTaskRow(task) {
    const row = taskTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = task.id;
    row.classList.toggle('is-done', task.done);

    row.querySelector('.task__toggle').checked = task.done;
    row.querySelector('.task__title').textContent = task.title;

    // The small line under the title: course, due date, and "Overdue" if late.
    const meta = row.querySelector('.task__meta');
    const details = [];
    if (task.course) details.push(task.course);
    if (task.due) details.push('Due ' + formatDue(task.due));
    meta.textContent = details.join(' \u00b7 ');   // \u00b7 is a middle dot

    if (isOverdue(task)) {
      const flag = document.createElement('span');
      flag.className = 'is-overdue';
      flag.textContent = 'Overdue';
      meta.append(details.length ? ' \u00b7 ' : '', flag);
    }
    meta.hidden = meta.textContent === '';

    // Each delete button names its task, so a screen reader says
    // "Delete task: Read chapter 2" rather than just "Delete".
    row.querySelector('.task__delete').setAttribute('aria-label', 'Delete task: ' + task.title);
    return row;
  }

  // Which tasks the current filter lets through.
  function visibleTasks() {
    if (currentFilter === 'todo') return tasks.filter((task) => !task.done);
    if (currentFilter === 'done') return tasks.filter((task) => task.done);
    return tasks;
  }

  // THE SUMMARY: count, progress bar, empty message and the clear button.
  function renderSummary() {
    const doneCount = tasks.filter((task) => task.done).length;
    countText.textContent = `${doneCount} of ${tasks.length} done`;

    // The bar's scale goes from 0 (nothing done) to 1 (everything done).
    const share = tasks.length === 0 ? 0 : doneCount / tasks.length;
    progressBar.style.transform = `scaleX(${share})`;

    clearButton.disabled = doneCount === 0;

    const showing = visibleTasks().length;
    emptyMessage.hidden = showing > 0;
    if (tasks.length === 0) {
      emptyMessage.textContent = 'No tasks yet. Add your first one with the form.';
    } else if (currentFilter === 'done') {
      emptyMessage.textContent = 'Nothing finished yet. Tick a task when it is done.';
    } else {
      emptyMessage.textContent = 'Everything is done. Nice work.';
    }
  }

  // DRAW THE LIST: build a row for every visible task and put them all in
  // the list at once. replaceChildren() removes the old rows first.
  // The ... (spread) passes each row in the array as a separate argument.
  function renderTasks() {
    taskList.replaceChildren(...visibleTasks().map(buildTaskRow));
    renderSummary();
  }

  // ADD A TASK when the form is submitted.
  taskForm.addEventListener('submit', (event) => {
    event.preventDefault();   // stop the browser reloading the page
    const title = titleInput.value.trim();   // trim() removes spaces at both ends

    // VALIDATION: the title must not be empty.
    if (title === '') {
      titleError.textContent = 'Please type what the task is.';
      titleInput.setAttribute('aria-invalid', 'true');
      titleInput.focus();
      // If the box already had focus (the visitor pressed Enter in it), focusing
      // it again is silent, so the message is also sent to the live region.
      announce('Please type what the task is.');
      return;
    }

    const newTask = {
      id: makeId(),
      title: title,
      course: courseInput.value.trim(),
      due: dueInput.value,
      done: false
    };

    tasks.unshift(newTask);   // unshift adds to the START of the array: newest first
    saveTasks();

    // If the list is showing only finished tasks, switch to "All" so the new task is visible.
    if (currentFilter === 'done') {
      setTaskFilter('all');
    } else {
      renderTasks();
    }

    // Play the arrival animation on the new row (it is first in the list).
    const newRow = taskList.querySelector(`[data-id="${newTask.id}"]`);
    if (newRow) newRow.classList.add('is-new');

    taskForm.reset();
    titleInput.focus();
    announce('Task added: ' + title);
  });

  // Clear the error message as soon as something is typed.
  titleInput.addEventListener('input', () => {
    if (titleInput.value.trim() !== '') {
      titleError.textContent = '';
      titleInput.removeAttribute('aria-invalid');
    }
  });

  // COMPLETE A TASK: one 'change' listener on the list catches every checkbox
  // (event delegation). closest('.task') finds the row, and its data-id tells
  // us which object in the array to update. find() returns that object.
  taskList.addEventListener('change', (event) => {
    if (!event.target.matches('.task__toggle')) return;

    const row = event.target.closest('.task');
    const task = tasks.find((item) => item.id === row.dataset.id);
    task.done = event.target.checked;
    saveTasks();

    if (currentFilter === 'all') {
      // Update just this row, so keyboard focus stays on its checkbox.
      row.classList.toggle('is-done', task.done);
      const freshMeta = buildTaskRow(task).querySelector('.task__meta');
      row.querySelector('.task__meta').replaceWith(freshMeta);
      renderSummary();
    } else {
      // The filter now hides this task, so redraw and move focus to the heading.
      renderTasks();
      listHeading.focus();
    }
    announce(task.done ? 'Marked as done: ' + task.title : 'Marked as not done: ' + task.title);
  });

  // DELETE A TASK: play the exit animation, then remove it from the array.
  taskList.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('.task__delete');
    if (!deleteButton) return;

    const row = deleteButton.closest('.task');
    const id = row.dataset.id;
    const task = tasks.find((item) => item.id === id);

    // Decide where keyboard focus goes next: the next row, else the previous
    // row, else the "What needs doing?" box.
    const neighbour = row.nextElementSibling || row.previousElementSibling;

    row.classList.add('is-leaving');
    const animationsDone = Promise.all(row.getAnimations().map((animation) => animation.finished));
    const safetyTimer = new Promise((resolve) => window.setTimeout(resolve, 300));

    Promise.race([animationsDone, safetyTimer]).then(() => {
      // filter() makes a new array WITHOUT the deleted task.
      tasks = tasks.filter((item) => item.id !== id);
      saveTasks();
      renderTasks();

      const nextRow = neighbour && taskList.querySelector(`[data-id="${neighbour.dataset.id}"]`);
      if (nextRow) {
        nextRow.querySelector('.task__toggle').focus();
      } else {
        titleInput.focus();
      }
      announce('Deleted: ' + task.title);
    });
  });

  // CLEAR COMPLETED: keep only the tasks that are not done.
  clearButton.addEventListener('click', () => {
    const removed = tasks.filter((task) => task.done).length;
    tasks = tasks.filter((task) => !task.done);
    saveTasks();
    renderTasks();
    listHeading.focus();
    announce(`Removed ${removed} completed ${removed === 1 ? 'task' : 'tasks'}.`);
  });

  // FILTER BUTTONS: All, To do, Done.
  function setTaskFilter(filter) {
    currentFilter = filter;
    taskFilterButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.taskFilter === filter));
    });
    renderTasks();
  }

  taskFilterButtons.forEach((button) => {
    button.addEventListener('click', () => setTaskFilter(button.dataset.taskFilter));
  });

  // First drawing of the list when the page opens.
  renderTasks();
}


/* --------------------------------------------------------------------------
   10. CONTACT FORM: VALIDATION AND SENDING
   The brief asks for three checks: no field may be empty, the email must
   look like an email, and the phone number must contain only digits.
   Each check is a small function that returns an error message, or an
   empty string ('') when the value is fine.
   -------------------------------------------------------------------------- */
const contactForm = document.getElementById('contact-form');

if (contactForm) {
  // REGULAR EXPRESSIONS (patterns for checking text):
  //   EMAIL_PATTERN: some characters, an @, more characters, a dot, then at
  //   least two characters. [^\s@]+ means "one or more characters that are
  //   not a space and not an @". ^ and $ mean the whole value must match.
  //   DIGITS_ONLY: \d means a digit (0 to 9); \d+ means one or more of them.
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const DIGITS_ONLY = /^\d+$/;

  // The four inputs, as an array, in the order they appear on the page.
  const contactFields = ['name', 'email', 'phone', 'message'].map((name) => document.getElementById('contact-' + name));

  const formStatus = document.getElementById('form-status');
  const submitButton = document.getElementById('contact-submit');
  const successBox = document.getElementById('form-success');
  const successName = document.getElementById('success-name');
  const sendAnotherButton = document.getElementById('send-another');

  // One checking function per field, stored in an object and looked up by
  // the input's name attribute (checks.email, checks.phone, ...).
  const checks = {
    name(value) {
      if (value === '') return 'Please enter your name.';
      return '';
    },
    email(value) {
      if (value === '') return 'Please enter your email address.';
      if (!EMAIL_PATTERN.test(value)) return 'Please enter a valid email address, like name@example.com.';
      return '';
    },
    phone(value) {
      if (value === '') return 'Please enter your phone number.';
      if (!DIGITS_ONLY.test(value)) return 'Use digits only: no spaces, dashes, brackets or + sign.';
      if (value.length < 7 || value.length > 15) return 'A phone number should be between 7 and 15 digits long.';
      return '';
    },
    message(value) {
      if (value === '') return 'Please write a message.';
      return '';
    }
  };

  // Shows (or clears) the message under a field, and sets aria-invalid so
  // the red border appears and screen readers know the field has a problem.
  function showFieldError(field, message) {
    document.getElementById(field.id + '-error').textContent = message;
    if (message) {
      field.setAttribute('aria-invalid', 'true');
    } else {
      field.removeAttribute('aria-invalid');
    }
  }

  // Checks one field and returns true if it passed.
  function validateField(field) {
    const message = checks[field.name](field.value.trim());
    showFieldError(field, message);
    return message === '';
  }

  // LIVE CHECKING: before the first Send, a field is only checked when the
  // visitor leaves it after typing something (so nobody is told off for a
  // box they have not reached yet). After a failed Send, every keystroke
  // re-checks, so the red message disappears the moment the value is fixed.
  let hasTriedToSend = false;

  contactFields.forEach((field) => {
    field.addEventListener('blur', () => {
      if (field.value.trim() !== '') validateField(field);
    });
    field.addEventListener('input', () => {
      if (hasTriedToSend || field.hasAttribute('aria-invalid')) validateField(field);
    });
  });

  // SENDING. async lets us use await: the function pauses at "await fetch(...)"
  // until Netlify answers, without freezing the page.
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();   // we send the form ourselves, below
    hasTriedToSend = true;

    // Check every field; keep the ones that failed.
    const invalidFields = contactFields.filter((field) => !validateField(field));

    if (invalidFields.length > 0) {
      // The message names how many fields need attention in words, not only by
      // colour, so it works for everyone, including people who cannot see red.
      formStatus.textContent = invalidFields.length === 1
        ? 'Please fix the field with a message under it.'
        : `Please fix the ${invalidFields.length} fields with a message under them.`;
      invalidFields[0].focus();   // take the visitor straight to the first problem
      return;
    }

    formStatus.textContent = '';
    const buttonContent = submitButton.innerHTML;
    submitButton.disabled = true;   // stops a double send
    submitButton.textContent = 'Sending...';

    try {
      // fetch() sends the form to Netlify in the background. FormData collects
      // every field; URLSearchParams turns it into the "name=value&..." text
      // format that Netlify's form handling expects.
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(contactForm)).toString()
      });

      // 404 or 405 means this copy of the site has no form handling switched on
      // (for example a GitHub Pages copy, or Netlify before form detection is
      // enabled). The checks still passed, so the visitor is told exactly that.
      if (response.status === 404 || response.status === 405) {
        formStatus.textContent = 'Every field passed the checks, but this copy of the site cannot send messages. The live Netlify site can.';
        return;
      }

      if (!response.ok) {
        throw new Error('The server answered with status ' + response.status);
      }

      // Success: swap the form for the thank-you message and move focus to it.
      successName.textContent = contactFields[0].value.trim();
      contactForm.reset();
      hasTriedToSend = false;
      contactForm.hidden = true;
      successBox.hidden = false;
      successBox.focus();
    } catch (error) {
      // Opened straight from a file on a computer (file://), there is no server to send to.
      if (window.location.protocol === 'file:') {
        formStatus.textContent = 'Every field passed the checks. Messages can only be sent from the live website.';
      } else {
        formStatus.textContent = 'Sorry, the message could not be sent. Please check your connection and try again.';
      }
    } finally {
      // finally runs whether sending worked or not: put the button back.
      submitButton.disabled = false;
      submitButton.innerHTML = buttonContent;
    }
  });

  // "Send another message" brings the empty form back.
  sendAnotherButton.addEventListener('click', () => {
    successBox.hidden = true;
    contactForm.hidden = false;
    contactFields[0].focus();
  });
}