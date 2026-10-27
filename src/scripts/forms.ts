/**
 * Progressive JSON form submission for [data-api-form] forms: posts to data-endpoint,
 * shows inline errors next to fields and moves focus to the first one.
 */
interface ApiError {
  error: string;
  fields?: Record<string, string>;
}

for (const form of document.querySelectorAll<HTMLFormElement>('form[data-api-form]')) {
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const label = submit?.textContent ?? '';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submit?.disabled) return;
    for (const el of form.querySelectorAll('[data-field-error]')) el.textContent = '';
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');

    const data = Object.fromEntries(
      [...new FormData(form).entries()]
        .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
        .map(([key, value]) => [
          key === 'cf-turnstile-response' ? 'turnstile_token' : key,
          String(value).trim(),
        ]),
    );
    if (submit) {
      submit.disabled = true;
      submit.textContent = submit.dataset.busy ?? 'Sending…';
    }
    try {
      const response = await fetch(form.dataset.endpoint ?? '', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = (await response.json().catch(() => ({}))) as ApiError & {
        redirect?: string;
        message?: string;
      };
      if (response.ok) {
        if (body.redirect) {
          window.location.assign(body.redirect);
          return;
        }
        form.reset();
        if (status) status.textContent = body.message ?? form.dataset.success ?? 'Sent.';
        return;
      }
      let firstInvalid: HTMLElement | null = null;
      for (const [name, message] of Object.entries(body.fields ?? {})) {
        const field = form.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
        const slot = form.querySelector<HTMLElement>(`[data-field-error="${CSS.escape(name)}"]`);
        if (slot) slot.textContent = message;
        field?.setAttribute('aria-invalid', 'true');
        firstInvalid ??= field;
      }
      if (status)
        status.textContent =
          body.error ?? 'The form could not be sent. Check the fields and try again.';
      firstInvalid?.focus();
    } catch {
      if (status)
        status.textContent = 'The form could not be sent because the connection failed. Try again.';
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = label;
      }
      // Turnstile tokens are single-use.
      (window as { turnstile?: { reset: () => void } }).turnstile?.reset();
    }
  });
}
