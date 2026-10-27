(() => {
  const encoder = new TextEncoder();
  const $ = id => document.getElementById(id);
  const form = $('unlock-form');
  const input = $('unlock-key');
  const error = $('unlock-error');

  // Basic profile is public (public.js); KVKK-sensitive fields arrive only after decrypting data.js.
  const publicProfile = window.__PROFILE_PUBLIC__ || {};
  let privateProfile = null;
  let token = '';
  let lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'tr';

  const I18N = {
    tr: {
      download: 'İndir', pdfHint: 'Yazdırma penceresinde “PDF olarak kaydet”', docxHint: 'Düzenlenebilir belge', pngHint: 'Görsel; WhatsApp ve e-postada paylaşım için', txt: 'Metin (.txt)', txtHint: 'İş ilanı sitelerine kopyala-yapıştır için',
      copy: 'Bağlantıyı kopyala', copied: 'Kopyalandı ✓',
      unlockOpen: 'Tam profili aç', unlockTitle: 'Kişisel bilgiler şifrelidir',
      unlockCopy: 'Fotoğraf, telefon, e-posta ve doğum bilgileri KVKK kapsamında yalnızca şifreli paylaşım bağlantısına sahip kişilere açılır. Bağlantıyı ya da anahtarı yapıştırın; anahtar sunucuya gönderilmez.',
      unlockLabel: 'Anahtar veya paylaşım bağlantısı', unlockButton: 'Aç',
      full: 'Tam sürüm', basic: 'Temel sürüm',
      contact: 'İletişim', personal: 'Kişisel', skills: 'Yetkinlikler', languages: 'Diller',
      qr: 'Dijital özgeçmiş için QR kodu okutun',
      summary: 'Profil', experience: 'Deneyim', education: 'Eğitim', certifications: 'Sertifikalar',
      career: 'Çalışabileceğim alanlar', interests: 'İlgi alanları', uses: 'Ne işe yarar',
      phone: 'Telefon', email: 'E-posta', city: 'Şehir', address: 'Adres', github: 'GitHub',
      birthDate: 'Doğum tarihi', birthPlace: 'Doğum yeri',
      hiddenContact: 'Telefon ve e-posta şifreli bağlantıyla görünür',
      document: 'Özgeçmiş', photo: 'fotoğrafı', file: 'CV',
      footBasic: 'Bu sürüm temel bilgileri içerir. İletişim ve kişisel bilgiler yalnızca şifreli paylaşım bağlantısıyla görüntülenir.',
      footFull: 'Kişisel bilgiler yalnızca paylaşım bağlantısıyla, bu tarayıcıda çözülerek görüntülenir.',
      format: 'Anahtar 43 karakter olmalı. Bağlantının tamamını ya da # işaretinden sonraki kısmı yapıştırın.',
      wrong: 'Bu anahtar bu profili açmıyor. Bağlantının güncel olduğundan emin olun.',
      missing: 'Şifreli içerik yüklenemedi. Sayfayı yenileyip tekrar deneyin.',
      exportFailed: 'Dosya oluşturulamadı: ',
      copyPrompt: 'Bağlantıyı kopyalayın:',
    },
    en: {
      download: 'Download', pdfHint: 'Choose “Save as PDF” in the print dialog', docxHint: 'Editable document', pngHint: 'Image for messaging and email', txt: 'Plain text (.txt)', txtHint: 'For pasting into job sites',
      copy: 'Copy link', copied: 'Copied ✓',
      unlockOpen: 'Unlock full profile', unlockTitle: 'Personal details are encrypted',
      unlockCopy: 'Photo, phone, email and date of birth are shown only to people who have the encrypted share link. Paste the link or the key; the key is never sent to the server.',
      unlockLabel: 'Key or share link', unlockButton: 'Unlock',
      full: 'Full version', basic: 'Basic version',
      contact: 'Contact', personal: 'Personal', skills: 'Skills', languages: 'Languages',
      qr: 'Scan the QR code for the digital CV',
      summary: 'Profile', experience: 'Experience', education: 'Education', certifications: 'Certifications',
      career: 'Areas I can work in', interests: 'Interests', uses: 'What it is for',
      phone: 'Phone', email: 'Email', city: 'City', address: 'Address', github: 'GitHub',
      birthDate: 'Date of birth', birthPlace: 'Place of birth',
      hiddenContact: 'Phone and email are visible with the encrypted link',
      document: 'Resume', photo: 'photo', file: 'CV-EN',
      footBasic: 'This version shows basic information. Contact and personal details are visible only with the encrypted share link.',
      footFull: 'Personal details are decrypted in this browser and shown only to holders of the share link.',
      format: 'The key must be 43 characters. Paste the full link or the part after the # sign.',
      wrong: 'This key does not unlock this profile. Make sure the link is up to date.',
      missing: 'The encrypted content could not be loaded. Refresh the page and try again.',
      exportFailed: 'Could not create the file: ',
      copyPrompt: 'Copy the link:',
    },
  };
  const t = key => I18N[lang][key];

  // ---- Decryption (format v1, produced by tools/build.mjs) ----
  function bytesFromBase64(value) {
    return Uint8Array.from(atob(value), c => c.charCodeAt(0));
  }
  function concat(...parts) {
    const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }
  function equal(a, b) {
    if (a.length !== b.length) return false;
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
    return difference === 0;
  }
  async function decrypt(key) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(key)) throw new Error('format');
    if (typeof window.__PROFILE_CIPHER__ !== 'string') throw new Error('missing');
    const blob = bytesFromBase64(window.__PROFILE_CIPHER__);
    if (blob.length < 65 || blob[0] !== 1) throw new Error('missing');
    const iv = blob.slice(1, 17);
    const mac = blob.slice(17, 49);
    const ciphertext = blob.slice(49);
    const macKeyBytes = await crypto.subtle.digest('SHA-256', encoder.encode('mac-v1:' + key));
    const macKey = await crypto.subtle.importKey('raw', macKeyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const expectedMac = new Uint8Array(await crypto.subtle.sign('HMAC', macKey, concat(blob.slice(0, 17), ciphertext)));
    if (!equal(mac, expectedMac)) throw new Error('wrong');
    const aesKeyBytes = await crypto.subtle.digest('SHA-256', encoder.encode('enc-v1:' + key));
    const aesKey = await crypto.subtle.importKey('raw', aesKeyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
    const clear = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, aesKey, ciphertext);
    return JSON.parse(new TextDecoder().decode(clear));
  }
  function normalizeToken(value) {
    let raw = value.trim();
    try { raw = decodeURIComponent(raw); } catch (_) { /* keep as typed */ }
    const hash = raw.indexOf('#');
    return (hash >= 0 ? raw.slice(hash + 1) : raw).replace(/\s+/g, '');
  }

  // ---- Data ----
  function view() {
    const merged = { ...publicProfile, ...(privateProfile || {}) };
    return lang === 'en' ? { ...merged, ...(publicProfile.en || {}) } : merged;
  }
  function pageUrl() {
    return location.origin + location.pathname + (lang === 'en' ? '?lang=en' : '');
  }
  function shareLink() {
    return pageUrl() + (privateProfile ? '#' + token : '');
  }

  // ---- Helpers ----
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function phoneDigits(phone) {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('90')) return digits;
    return '90' + digits.replace(/^0/, '');
  }
  function initials(name) {
    return (name || '').split(/\s+/).filter(Boolean).map(part => part[0].toLocaleUpperCase('tr-TR')).slice(0, 2).join('');
  }
  function contactItems(data) {
    const items = [];
    if (data.phone) items.push({ label: t('phone'), text: data.phone, href: 'tel:+' + phoneDigits(data.phone) });
    if (data.email) items.push({ label: t('email'), text: data.email, href: 'mailto:' + data.email });
    if (data.city) items.push({ label: t('city'), text: data.city });
    if (data.address) items.push({ label: t('address'), text: data.address });
    if (data.github) items.push({ label: t('github'), text: data.github.replace(/^https?:\/\//, ''), href: data.github });
    return items;
  }
  function personalItems(data) {
    const items = [];
    if (data.birthDate) items.push({ label: t('birthDate'), text: data.birthDate });
    if (data.birthPlace) items.push({ label: t('birthPlace'), text: data.birthPlace });
    return items;
  }
  function fillList(id, items) {
    $(id).replaceChildren(...items.map(item => {
      const li = el('li');
      li.append(el('small', '', item.label));
      if (item.href) {
        const link = el('a', '', item.text);
        link.href = item.href;
        if (/^https?:/.test(item.href)) { link.target = '_blank'; link.rel = 'noreferrer'; }
        li.append(link);
      } else {
        li.append(el('span', '', item.text));
      }
      return li;
    }));
    return items.length > 0;
  }
  function fillTags(id, values) {
    $(id).replaceChildren(...values.map(value => el('li', '', value)));
    return values.length > 0;
  }
  function fillEntries(id, entries) {
    $(id).replaceChildren(...entries.map(entry => {
      const row = el('div', entry.period ? 'entry' : 'entry no-period');
      if (entry.period) row.append(el('span', 'period', entry.period));
      const body = el('div');
      body.append(el('h3', '', entry.title));
      if (entry.place) body.append(el('p', 'place', entry.place));
      if (entry.note) body.append(el('p', 'note', entry.note));
      if ((entry.uses || []).length) {
        body.append(el('p', 'uses-title', t('uses')));
        const uses = el('ul', 'uses');
        uses.append(...entry.uses.map(use => el('li', '', use)));
        body.append(uses);
      }
      row.append(body);
      return row;
    }));
    return entries.length > 0;
  }
  function fileName(data, ext) {
    return (data.name || 'CV').replace(/\s+/g, '-') + '-' + t('file') + '.' + ext;
  }

  // ---- QR ----
  function qrMatrix(text) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return { size: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
  }
  function qrSvg(text) {
    const { size, dark } = qrMatrix(text);
    let d = '';
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (dark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="#202724" d="${d}"/></svg>`;
  }
  async function qrPng(text, pixels) {
    const { size, dark } = qrMatrix(text);
    const quiet = 2;
    const cell = Math.floor(pixels / (size + quiet * 2));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = cell * (size + quiet * 2);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#202724';
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (dark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  }

  // ---- Render ----
  function render() {
    const data = view();
    document.documentElement.lang = lang;
    document.title = (data.name || '') + ' | ' + t('document');
    for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
    for (const button of document.querySelectorAll('[data-lang]')) button.setAttribute('aria-pressed', String(button.dataset.lang === lang));

    $('brand').replaceChildren(document.createTextNode(initials(data.name)), el('b', '', '.'));
    $('tier-pill').classList.toggle('full', !!privateProfile);
    $('tier-pill').querySelector('b').textContent = privateProfile ? t('full') : t('basic');
    $('open-unlock').hidden = !!privateProfile;
    if (privateProfile) $('unlock-panel').hidden = true;
    $('foot').textContent = privateProfile ? t('footFull') : t('footBasic');

    $('name').textContent = data.name || '';
    $('title').textContent = data.title || '';

    const photo = $('photo');
    photo.replaceChildren();
    if (data.photo) {
      photo.style.backgroundImage = `url("${data.photo}")`;
      photo.setAttribute('role', 'img');
      photo.setAttribute('aria-label', data.name + ' ' + t('photo'));
    } else {
      photo.style.backgroundImage = '';
      photo.removeAttribute('role');
      photo.textContent = initials(data.name);
    }

    fillList('contact-list', contactItems(data));
    if (!privateProfile) $('contact-list').append(el('li', 'locked-note', '✳ ' + t('hiddenContact')));
    $('personal-block').hidden = !fillList('personal-list', personalItems(data));
    $('skills-block').hidden = !fillTags('skills', data.skills || []);
    $('languages-block').hidden = !fillList('languages', (data.languages || []).map(l => ({ label: l.level || '', text: l.name })));

    $('summary').textContent = data.summary || '';
    $('summary-block').hidden = !data.summary;
    $('experience-block').hidden = !fillEntries('experience', data.experience || []);
    $('education-block').hidden = !fillEntries('education', data.education || []);
    $('certifications-block').hidden = !fillEntries('certifications', data.certifications || []);
    $('career').replaceChildren(...(data.careerAreas || []).map(area => {
      const card = el('div', 'career-card');
      card.append(el('h3', '', area.title));
      if (area.note) card.append(el('p', '', area.note));
      return card;
    }));
    $('career-block').hidden = !(data.careerAreas || []).length;
    $('interests-block').hidden = !fillTags('interests', data.interests || []);

    let n = 0;
    for (const section of document.querySelectorAll('.cv-section')) {
      if (!section.hidden) section.querySelector('h2 span').textContent = String(++n).padStart(2, '0');
    }

    // Uppercase in JS rather than CSS so Turkish i/İ stay correct in every browser and in the PNG export.
    for (const node of document.querySelectorAll('.side-block h2, .cv-title, .contact-list small, .uses-title')) {
      node.textContent = node.textContent.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US');
    }

    $('qr').innerHTML = qrSvg(shareLink());
    history.replaceState(null, '', shareLink());
  }

  // ---- Word (.docx) ----
  async function buildDocx(data) {
    const d = await loadScript('vendor/docx.umd.js', 'docx');
    const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, VerticalAlign } = d;
    const green = '24473E', olive = '798760', muted = '69716A';
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };

    const heading = text => new Paragraph({
      spacing: { before: 280, after: 100 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D9D8CF', space: 4 } },
      children: [new TextRun({ text, font: 'Georgia', size: 28, color: green })],
    });
    const entry = item => {
      const out = [new Paragraph({
        spacing: { before: 120 },
        children: [
          new TextRun({ text: item.title, bold: true, size: 22 }),
          ...(item.period ? [new TextRun({ text: '   ' + item.period, size: 18, color: olive, bold: true })] : []),
        ],
      })];
      if (item.place) out.push(new Paragraph({ children: [new TextRun({ text: item.place, size: 20 })] }));
      if (item.note) out.push(new Paragraph({ children: [new TextRun({ text: item.note, size: 19, color: muted })] }));
      for (const use of item.uses || []) out.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: use, size: 19 })] }));
      return out;
    };
    const line = (label, text) => new Paragraph({
      spacing: { after: 30 },
      children: [new TextRun({ text: label + ': ', bold: true, size: 19, color: green }), new TextRun({ text, size: 19 })],
    });

    const photoCell = [];
    if (data.photo && /^data:image\/(png|jpe?g);base64,/.test(data.photo)) {
      const bytes = bytesFromBase64(data.photo.split(',')[1]);
      photoCell.push(new Paragraph({ children: [new ImageRun({ data: bytes, transformation: { width: 105, height: 140 } })] }));
    }
    const qrBytes = await qrPng(shareLink(), 360);

    const headerInfo = [
      new Paragraph({ children: [new TextRun({ text: data.name, font: 'Georgia', size: 52 })] }),
      new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: (data.title || '').toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US'), bold: true, size: 18, color: olive, characterSpacing: 40 })] }),
      ...[...contactItems(data), ...personalItems(data)].map(item => line(item.label, item.text)),
    ];
    const qrCell = [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: qrBytes, transformation: { width: 100, height: 100 } })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t('qr'), size: 15, color: muted })] }),
    ];
    const cells = [];
    if (photoCell.length) cells.push(new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, children: photoCell }));
    cells.push(new TableCell({ width: { size: photoCell.length ? 60 : 80, type: WidthType.PERCENTAGE }, children: headerInfo }));
    cells.push(new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, children: qrCell }));

    const body = [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ children: cells })] })];
    if (data.summary) body.push(heading(t('summary')), new Paragraph({ children: [new TextRun({ text: data.summary, size: 21 })] }));
    if ((data.experience || []).length) body.push(heading(t('experience')), ...data.experience.flatMap(entry));
    if ((data.education || []).length) body.push(heading(t('education')), ...data.education.flatMap(entry));
    if ((data.certifications || []).length) body.push(heading(t('certifications')), ...data.certifications.flatMap(entry));
    if ((data.careerAreas || []).length) body.push(heading(t('career')), ...data.careerAreas.flatMap(entry));
    if ((data.skills || []).length) body.push(heading(t('skills')), new Paragraph({ children: [new TextRun({ text: data.skills.join(' · '), size: 20 })] }));
    if ((data.languages || []).length) body.push(heading(t('languages')), ...data.languages.map(l => line(l.name, l.level || '')));
    if ((data.interests || []).length) body.push(heading(t('interests')), new Paragraph({ children: [new TextRun({ text: data.interests.join(' · '), size: 20 })] }));

    const doc = new Document({
      creator: data.name,
      title: data.name + ' — ' + t('document'),
      styles: { default: { document: { run: { font: 'Calibri', color: '202724' } } } },
      sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children: body }],
    });
    return Packer.toBlob(doc);
  }
  // ---- PNG and plain text ----
  function loadScript(src, global) {
    if (window[global]) return Promise.resolve(window[global]);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve(window[global]);
      script.onerror = () => reject(new Error(src));
      document.head.append(script);
    });
  }
  async function buildPng() {
    const html2canvas = await loadScript('vendor/html2canvas.min.js', 'html2canvas');
    // windowWidth forces the desktop two-column layout even when exporting from a phone.
    const canvas = await html2canvas($('cv'), { scale: 2, backgroundColor: '#faf9f5', windowWidth: 1100, useCORS: true });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }
  function buildText(data) {
    const lines = [data.name, data.title, ''];
    for (const item of [...contactItems(data), ...personalItems(data)]) lines.push(item.label + ': ' + item.text);
    const section = title => lines.push('', title.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : 'en-US'), '-'.repeat(title.length));
    const entries = list => {
      for (const item of list) {
        lines.push([item.title, item.period].filter(Boolean).join(' — '));
        if (item.place) lines.push(item.place);
        if (item.note) lines.push(item.note);
        for (const use of item.uses || []) lines.push('  • ' + use);
        lines.push('');
      }
      lines.pop();
    };
    if (data.summary) { section(t('summary')); lines.push(data.summary); }
    if ((data.experience || []).length) { section(t('experience')); entries(data.experience); }
    if ((data.education || []).length) { section(t('education')); entries(data.education); }
    if ((data.certifications || []).length) { section(t('certifications')); entries(data.certifications); }
    if ((data.careerAreas || []).length) { section(t('career')); for (const area of data.careerAreas) lines.push('• ' + area.title + (area.note ? ': ' + area.note : '')); }
    if ((data.skills || []).length) { section(t('skills')); lines.push(data.skills.join(', ')); }
    if ((data.languages || []).length) { section(t('languages')); for (const l of data.languages) lines.push(l.name + (l.level ? ': ' + l.level : '')); }
    if ((data.interests || []).length) { section(t('interests')); lines.push(data.interests.join(', ')); }
    lines.push('', shareLink());
    return lines.join('\r\n') + '\r\n';
  }

  function save(blob, name) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  // ---- Unlock flow ----
  async function unlock(value) {
    error.hidden = true;
    const key = normalizeToken(value);
    try {
      privateProfile = await decrypt(key);
      token = key;
    } catch (e) {
      $('unlock-panel').hidden = false;
      error.textContent = t(['format', 'wrong', 'missing'].includes(e.message) ? e.message : 'wrong');
      error.hidden = false;
      return;
    }
    render();
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    unlock(input.value);
  });
  $('open-unlock').addEventListener('click', () => {
    $('unlock-panel').hidden = !$('unlock-panel').hidden;
    if (!$('unlock-panel').hidden) input.focus();
  });
  for (const button of document.querySelectorAll('[data-lang]')) {
    button.addEventListener('click', () => {
      lang = button.dataset.lang;
      error.hidden = true;
      render();
    });
  }
  const exporters = {
    pdf: async () => window.print(),
    docx: async data => save(await buildDocx(data), fileName(data, 'docx')),
    png: async data => save(await buildPng(), fileName(data, 'png')),
    txt: async data => save(new Blob([buildText(data)], { type: 'text/plain;charset=utf-8' }), fileName(data, 'txt')),
  };
  for (const button of document.querySelectorAll('[data-export]')) {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await exporters[button.dataset.export](view());
        $('export-menu').open = false;
      } catch (e) {
        alert(t('exportFailed') + e.message);
      } finally {
        button.disabled = false;
      }
    });
  }
  document.addEventListener('click', event => {
    if (!$('export-menu').contains(event.target)) $('export-menu').open = false;
  });
  $('copy-link').addEventListener('click', async event => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(shareLink());
      button.textContent = t('copied');
    } catch (_) {
      prompt(t('copyPrompt'), shareLink());
    }
    setTimeout(() => { button.textContent = t('copy'); }, 2000);
  });
  window.addEventListener('beforeprint', () => { document.title = fileName(view(), 'pdf').replace(/\.pdf$/, ''); });
  window.addEventListener('afterprint', () => { document.title = (view().name || '') + ' | ' + t('document'); });

  const initialHash = location.hash;
  render();
  if (initialHash.length > 1) unlock(initialHash);
})();
