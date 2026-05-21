const CORRECT_PASSCODE = '002026';
const SESSION_KEY = 'certflow_authenticated';
const SESSION_DURATION = 24 * 60 * 60 * 1000;

const DIGIT_COUNT = 6;

function checkExistingSession() {
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return false;
  try {
    const { expiry } = JSON.parse(session);
    if (expiry && Date.now() < expiry) {
      window.location.href = 'index.html';
      return true;
    }
    localStorage.removeItem(SESSION_KEY);
  } catch {
    localStorage.removeItem(SESSION_KEY);
  }
  return false;
}

function createSession() {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      authenticated: true,
      expiry: Date.now() + SESSION_DURATION,
      loginTime: new Date().toISOString(),
    })
  );
}

function getDigitInputs() {
  return Array.from({ length: DIGIT_COUNT }, (_, i) =>
    document.getElementById(`passcode-${i}`)
  ).filter(Boolean);
}

function getPasscodeValue() {
  return getDigitInputs()
    .map((el) => el.value)
    .join('');
}

function syncHiddenPasscode() {
  const hidden = document.getElementById('passcode');
  if (hidden) hidden.value = getPasscodeValue();
}

function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  const group = document.getElementById('passcodeGroup');
  const card = document.getElementById('loginCard');
  if (errorText) errorText.textContent = message;
  if (errorDiv) errorDiv.hidden = false;
  group?.classList.add('is-error');
  card?.classList.add('shake');
  setTimeout(() => card?.classList.remove('shake'), 400);
}

function clearError() {
  const errorDiv = document.getElementById('errorMessage');
  const group = document.getElementById('passcodeGroup');
  if (errorDiv) errorDiv.hidden = true;
  group?.classList.remove('is-error');
}

function setLoading(loading) {
  const btn = document.getElementById('loginBtn');
  const text = btn?.querySelector('.btn-login__text');
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
  if (text) text.textContent = loading ? 'Verifying…' : 'Continue to dashboard';
}

function clearDigits() {
  getDigitInputs().forEach((el) => {
    el.value = '';
  });
  syncHiddenPasscode();
  getDigitInputs()[0]?.focus();
}

function showSuccessAndRedirect() {
  const btn = document.getElementById('loginBtn');
  const text = btn?.querySelector('.btn-login__text');
  const overlay = document.getElementById('loginSuccess');
  if (btn) {
    btn.classList.add('is-success');
    btn.classList.remove('loading');
    btn.disabled = true;
  }
  if (text) text.textContent = 'Success';
  if (overlay) {
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
  }
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1200);
}

async function attemptLogin(passcode) {
  clearError();
  setLoading(true);
  await new Promise((r) => setTimeout(r, 450));

  if (passcode === CORRECT_PASSCODE) {
    createSession();
    showSuccessAndRedirect();
    return;
  }

  setLoading(false);
  showError('Invalid passcode. Please try again.');
  clearDigits();
}

function setupPasscodeInputs() {
  const inputs = getDigitInputs();

  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val.slice(-1);
      syncHiddenPasscode();
      clearError();

      if (val && index < DIGIT_COUNT - 1) {
        inputs[index + 1].focus();
      }

      if (getPasscodeValue().length === DIGIT_COUNT) {
        document.getElementById('loginForm')?.requestSubmit();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        inputs[index - 1].focus();
        inputs[index - 1].value = '';
        syncHiddenPasscode();
      }
      if (e.key === 'ArrowLeft' && index > 0) inputs[index - 1].focus();
      if (e.key === 'ArrowRight' && index < DIGIT_COUNT - 1) inputs[index + 1].focus();
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, DIGIT_COUNT);
      pasted.split('').forEach((ch, i) => {
        if (inputs[i]) inputs[i].value = ch;
      });
      syncHiddenPasscode();
      const next = Math.min(pasted.length, DIGIT_COUNT - 1);
      inputs[next]?.focus();
      if (pasted.length === DIGIT_COUNT) {
        document.getElementById('loginForm')?.requestSubmit();
      }
    });

    input.addEventListener('focus', () => input.select());
  });
}

function setupForm() {
  const form = document.getElementById('loginForm');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = getPasscodeValue();
    if (code.length < DIGIT_COUNT) {
      showError('Enter all 6 digits');
      const firstEmpty = getDigitInputs().find((el) => !el.value);
      (firstEmpty || getDigitInputs()[0])?.focus();
      return;
    }
    attemptLogin(code);
  });
}

function openAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function closeAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAboutModal();
});

document.addEventListener('DOMContentLoaded', () => {
  if (checkExistingSession()) return;
  setupPasscodeInputs();
  setupForm();
  getDigitInputs()[0]?.focus();
});

Object.assign(window, { openAboutModal, closeAboutModal });
