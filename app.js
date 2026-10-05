/* ==========================================================================
   CENTRO TERAPÉUTICO A&B · Osteopatía y Biomagnetismo
   JavaScript vanilla (sin dependencias).
   --------------------------------------------------------------------------
   MÓDULOS
   01 Config y utilidades       09 Contadores
   02 Enlaces de WhatsApp       10 Mapa corporal interactivo
   03 Spinner de carga          11 Videos
   04 Cabecera y menú móvil     12 FAQ (acordeón)
   05 Títulos por palabras      13 Formulario → WhatsApp
   06 Revelado por scroll       14 Efectos de puntero (spotlight/tilt/magnético)
   07 Campo magnético (canvas)  15 Botón flotante y arranque
   08 Bucle de scroll/parallax
   ========================================================================== */
(() => {
    'use strict';
    window.__abReady = true;

    /* ============================ 01 CONFIG ============================== */
    const WA_NUMBER = '525544851260'; // 55 4485 1260 — número de WhatsApp del centro

    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const waUrl = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

    /* ====================== 02 ENLACES DE WHATSAPP ======================= */
    // Cada enlace con data-wa recibe su mensaje prellenado. Sin JS, el href base abre el chat igualmente.
    function initWhatsAppLinks() {
        $$('a[data-wa]').forEach((a) => { a.href = waUrl(a.dataset.wa); });
    }

    /* ======================= 03 SPINNER DE CARGA ========================= */
    function initLoader(onDone) {
        const loader = $('#loader');
        if (!loader) { onDone(); return; }

        const num = $('#ld-num'), ring = $('#ld-progress'), bar = $('#ld-bar'), msg = $('#ld-msg');
        const messages = ['Calibrando campo magnético', 'Alineando la columna', 'Equilibrando el cuerpo', 'Preparando tu experiencia'];
        const minTime = reduceMotion ? 350 : 2700;
        const start = performance.now();
        let value = 0, ready = false, finished = false;

        const paint = (v) => {
            num.textContent = Math.round(v);
            ring.style.strokeDashoffset = 100 - v;
            bar.style.transform = `scaleX(${v / 100})`;
            const m = messages[Math.min(messages.length - 1, Math.floor(v / 25.01))];
            if (msg.textContent !== m) msg.textContent = m;
        };

        // "Listo" = ventana cargada + tipografías (con tope de seguridad)
        const windowLoaded = new Promise((res) => {
            if (document.readyState === 'complete') res(); else window.addEventListener('load', res, { once: true });
        });
        const fontsLoaded = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        Promise.race([Promise.all([windowLoaded, fontsLoaded]), new Promise((r) => setTimeout(r, 6500))]).then(() => { ready = true; });

        const finish = () => {
            if (finished) return;
            finished = true;
            loader.classList.add('is-done');
            root.classList.remove('is-loading');
            document.body.classList.add('is-ready');
            onDone();
            setTimeout(() => loader.classList.add('is-hidden'), 1500);
            setTimeout(() => loader.remove(), 2200);
        };

        const tick = (now) => {
            const elapsed = now - start;
            // Avanza con una curva suave hasta 92 %; completa al estar todo listo y pasado el tiempo mínimo
            const timeFrac = clamp(elapsed / minTime, 0, 1);
            const target = ready && elapsed >= minTime ? 100 : Math.min(92, timeFrac * 92);
            value = lerp(value, target, 0.085);
            if (target === 100 && value > 99.4) value = 100;
            paint(value);
            if (value >= 100) { setTimeout(finish, 380); return; }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    /* ==================== 04 CABECERA Y MENÚ MÓVIL ======================= */
    function initMenu() {
        const burger = $('#burger'), menu = $('#menu');
        if (!burger || !menu) return {};
        const links = $$('a', menu);

        const setOpen = (open) => {
            burger.setAttribute('aria-expanded', String(open));
            burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
            menu.setAttribute('aria-hidden', String(!open));
            menu.classList.toggle('is-open', open);
            root.classList.toggle('menu-open', open);
            if (open) setTimeout(() => links[0] && links[0].focus({ preventScroll: true }), 450);
        };
        burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
        links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); burger.focus(); }
        });
        window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
        return { isOpen: () => menu.classList.contains('is-open') };
    }

    // Resalta en el menú la sección visible
    function initCurrentLink() {
        const links = $$('.nav__links a');
        const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
        if (!('IntersectionObserver' in window) || !sections.length) return;
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                links.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === `#${en.target.id}`));
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        sections.forEach((s) => io.observe(s));
    }

    /* ==================== 05 TÍTULOS POR PALABRAS ======================== */
    // Envuelve cada palabra en una máscara para animarla línea por línea al entrar en pantalla
    function splitText(el) {
        let idx = 0;
        el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    let text = child.textContent;
                    // Puntuación pegada a un elemento previo (p. ej. "</em>,"): se une a su última palabra
                    // para que la coma o el punto nunca queden solos al inicio de una línea.
                    const prev = child.previousSibling;
                    if (prev && prev.nodeType === 1 && /^[^ \t\n\r]/.test(text)) {
                        const words = prev.querySelectorAll('.wi');
                        const lastWord = words[words.length - 1];
                        if (lastWord) {
                            const glued = text.match(/^[^ \t\n\r]+/)[0];
                            lastWord.append(glued);
                            text = text.slice(glued.length);
                        }
                    }
                    text.split(/([ \t\n\r]+)/).forEach((part) => {
                        if (!part) return;
                        if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span'); w.className = 'w';
                        const wi = document.createElement('span'); wi.className = 'wi';
                        wi.style.setProperty('--i', idx++); wi.textContent = part;
                        w.appendChild(wi); frag.appendChild(w);
                    });
                    child.replaceWith(frag);
                } else if (child.nodeType === 1 && child.tagName !== 'BR') {
                    walk(child);
                }
            });
        };
        walk(el);
    }

    /* ===================== 06 REVELADO POR SCROLL ======================== */
    function initReveal() {
        $$('[data-split]').forEach(splitText);
        const els = $$('[data-reveal], [data-split]:not([data-split-hero])');

        if (!('IntersectionObserver' in window) || reduceMotion) {
            els.forEach((el) => { el.classList.add('is-in'); el.removeAttribute('data-reveal'); });
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => {
                if (!en.isIntersecting) return;
                const el = en.target;
                io.unobserve(el);
                el.classList.add('is-in');
                if (el.hasAttribute('data-reveal')) {
                    // Al terminar la animación se libera el elemento para que sus propias transiciones (hover, tilt) funcionen
                    const delay = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
                    setTimeout(() => el.removeAttribute('data-reveal'), (delay + 1.5) * 1000);
                }
            });
        }, { threshold: 0.14, rootMargin: '0px 0px -7% 0px' });
        els.forEach((el) => io.observe(el));
    }

    function startHero() {
        const h1 = $('[data-split-hero]');
        if (h1) setTimeout(() => h1.classList.add('is-in'), reduceMotion ? 0 : 350);
    }

    // Palabra que rota en el hero ("Terapia para ... dolor de espalda / dolores de cabeza ...")
    function initRotator() {
        const rot = $('#rotator');
        if (!rot) return;
        const track = $('.rotator__track', rot);
        const items = $$('span', track);
        const clone = items[0].cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);

        let i = 0;
        const lineH = () => items[0].offsetHeight;
        const setWidth = () => { rot.style.width = `${(items[i % items.length] || items[0]).getBoundingClientRect().width}px`; };
        setWidth();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(setWidth);
        window.addEventListener('resize', setWidth);
        if (reduceMotion) return;

        setInterval(() => {
            i += 1;
            track.style.transform = `translateY(${-i * lineH()}px)`;
            rot.style.width = `${(i === items.length ? items[0] : items[i]).getBoundingClientRect().width}px`;
            if (i === items.length) {
                // Salto invisible del clon al primer elemento para un bucle continuo
                setTimeout(() => {
                    track.style.transition = 'none';
                    track.style.transform = 'translateY(0)';
                    void track.offsetHeight;
                    track.style.transition = '';
                    i = 0;
                }, 950);
            }
        }, 2700);
    }

    // Medidor "Equilibrio corporal" del hero
    function initMeter() {
        const val = $('#meter-val'), bar = $('#meter-bar');
        if (!val || !bar) return;
        let v = 62, target = 94;
        const paint = () => { val.textContent = Math.round(v); bar.style.transform = `scaleX(${v / 100})`; };
        paint();
        if (reduceMotion) return;
        setInterval(() => { target = Math.random() < 0.5 ? 38 + Math.random() * 18 : 82 + Math.random() * 16; }, 3200);
        setInterval(() => { v = lerp(v, target, 0.07); paint(); }, 60);
    }

    /* ==================== 07 CAMPO MAGNÉTICO (CANVAS) ==================== */
    // Partículas que fluyen por un campo vectorial y se curvan alrededor del cursor, como limaduras junto a un imán.
    function initField() {
        const canvas = $('#field');
        const hero = $('#inicio');
        if (!canvas || !canvas.getContext) return;
        const ctx = canvas.getContext('2d');
        const palette = ['249,157,63', '127,208,220', '255,255,255'];
        const mouse = { x: -9999, y: -9999, on: false };
        let w = 0, h = 0, parts = [], raf = 0, visible = true, t = 0, last = 0;

        const spawn = () => ({
            x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0,
            r: Math.random() * 1.5 + 0.6,
            c: palette[Math.random() < 0.42 ? 0 : Math.random() < 0.78 ? 1 : 2],
            a: Math.random() * 0.5 + 0.4
        });
        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            w = rect.width; h = rect.height;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = clamp(Math.round((w * h) / 12500), 34, 118);
            parts = Array.from({ length: n }, spawn);
        };
        const flowAngle = (x, y) => (Math.sin(x * 0.0042 + t * 0.35) + Math.cos(y * 0.0037 - t * 0.28) + Math.sin((x + y) * 0.0021 + t * 0.2)) * 1.3;

        const draw = (now) => {
            const dt = Math.min((now - last) / 16.67 || 1, 3);
            last = now; t += 0.008 * dt;

            // Estela: se desvanece lo dibujado antes
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,0.17)';
            ctx.fillRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'lighter';

            for (const p of parts) {
                const a = flowAngle(p.x, p.y);
                p.vx += Math.cos(a) * 0.034 * dt;
                p.vy += Math.sin(a) * 0.034 * dt;
                if (mouse.on) {
                    const dx = mouse.x - p.x, dy = mouse.y - p.y, d2 = dx * dx + dy * dy;
                    if (d2 < 30000) {
                        const d = Math.sqrt(d2) + 0.001, f = 1 - d / 173;
                        // Componente radial (atracción) + tangencial (giro alrededor del polo)
                        p.vx += ((dx / d) * 0.2 + (-dy / d) * 0.36) * f * dt;
                        p.vy += ((dy / d) * 0.2 + (dx / d) * 0.36) * f * dt;
                    }
                }
                p.vx *= 0.955; p.vy *= 0.955;
                p.x += p.vx * dt; p.y += p.vy * dt;
                if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
                if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
            }
            // Conexiones entre partículas cercanas (red)
            ctx.lineWidth = 0.8;
            for (let i = 0; i < parts.length; i++) {
                const p = parts[i];
                for (let j = i + 1; j < parts.length; j++) {
                    const q = parts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
                    if (d2 < 11000) {
                        ctx.strokeStyle = `rgba(127,208,220,${(1 - d2 / 11000) * 0.22})`;
                        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
                    }
                }
            }
            for (const p of parts) {
                ctx.fillStyle = `rgba(${p.c},${p.a})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
            }
        };
        const loop = (now) => {
            if (!visible || document.hidden) { raf = 0; return; }
            draw(now);
            raf = requestAnimationFrame(loop);
        };
        const run = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); } };

        resize();
        if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
        if (reduceMotion) { for (let k = 0; k < 90; k++) draw(k * 16); return; }

        hero.addEventListener('pointermove', (e) => {
            const r = canvas.getBoundingClientRect();
            mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
        }, { passive: true });
        hero.addEventListener('pointerleave', () => { mouse.on = false; });
        if ('IntersectionObserver' in window) {
            new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) run(); }, { threshold: 0 }).observe(hero);
        }
        document.addEventListener('visibilitychange', run);
        run();
    }

    /* ================= 08 BUCLE DE SCROLL / PARALLAX ===================== */
    function initScrollEffects(menuApi) {
        const nav = $('#navbar'), progress = $('#scroll-progress');
        const heroInner = $('.hero__inner'), hero = $('#inicio');
        const parallax = $$('[data-parallax]');
        const timeline = $('#timeline'), tlLine = $('.timeline__line', timeline || document), tlSteps = $$('.tl-step');
        const giant = $('.giant'), giantTrack = $('#giant-track');
        const marqueeTrack = $('.marquee__track');
        const field = $('.orb__field'), figure = $('.orb__figure'), orb = $('#orb');

        let lastY = -1, velocity = 0, marqueeAnim = null, mx = 0, my = 0, tx = 0, ty = 0;
        const menuOpen = () => menuApi && menuApi.isOpen && menuApi.isOpen();

        // Parallax suave del orbe con el puntero (profundidad entre campo y figura)
        if (finePointer && !reduceMotion && hero) {
            hero.addEventListener('pointermove', (e) => {
                const r = hero.getBoundingClientRect();
                tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5;
            }, { passive: true });
            hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
        }

        const update = (y) => {
            const vh = window.innerHeight, doc = document.documentElement;
            const max = doc.scrollHeight - vh;
            if (progress) progress.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;

            // Cabecera: sólida al bajar, se oculta al hacer scroll hacia abajo y reaparece al subir
            if (nav) {
                nav.classList.toggle('is-solid', y > 30);
                const goingDown = lastY !== -1 && y > lastY;
                nav.classList.toggle('is-hidden', goingDown && y > 520 && !menuOpen());
            }

            if (reduceMotion) return;

            // Hero: el contenido se desvanece y desplaza mientras sales de él
            if (heroInner && y < vh * 1.2) {
                const p = clamp(y / (vh * 0.9), 0, 1);
                heroInner.style.opacity = String(1 - p * 0.85);
                heroInner.style.transform = `translate3d(0, ${y * 0.16}px, 0)`;
            }
            // Elementos con data-parallax
            parallax.forEach((el) => {
                const r = el.getBoundingClientRect();
                if (r.bottom < -100 || r.top > vh + 100) return;
                const speed = parseFloat(el.dataset.parallax) || 0.05;
                el.style.transform = `translate3d(0, ${-(r.top + r.height / 2 - vh / 2) * speed}px, 0)`;
            });
            // Timeline: la línea se llena y los pasos se encienden al pasar por el centro-alto de la pantalla
            if (timeline) {
                const r = timeline.getBoundingClientRect();
                const mark = vh * 0.58;
                tlLine.style.setProperty('--p', clamp((mark - r.top) / r.height, 0, 1).toFixed(4));
                let current = -1;
                tlSteps.forEach((s, i) => { if (s.getBoundingClientRect().top + 30 < mark) current = i; });
                tlSteps.forEach((s, i) => {
                    s.classList.toggle('is-active', i === current);
                    s.classList.toggle('is-passed', i < current);
                });
            }
            // Texto gigante que se desliza horizontalmente con el scroll
            if (giant && giantTrack) {
                const r = giant.getBoundingClientRect();
                const p = clamp((vh - r.top) / (vh + r.height), 0, 1);
                giantTrack.style.transform = `translate3d(${(0.04 - p * 1.3) * window.innerWidth}px, 0, 0)`;
            }
        };

        const loop = () => {
            const y = window.scrollY;
            const dy = y - lastY;
            if (lastY === -1 || dy !== 0) update(y);
            velocity = lerp(velocity, lastY === -1 ? 0 : dy, 0.12);
            lastY = y;

            // La cinta de texto acelera según la velocidad del scroll
            if (marqueeTrack && !reduceMotion) {
                if (!marqueeAnim && marqueeTrack.getAnimations) marqueeAnim = marqueeTrack.getAnimations()[0] || null;
                if (marqueeAnim) marqueeAnim.playbackRate = 1 + clamp(Math.abs(velocity) * 0.22, 0, 7);
            }
            // Profundidad con el puntero en el orbe
            if (field && figure) {
                mx = lerp(mx, tx, 0.06); my = lerp(my, ty, 0.06);
                field.style.transform = `translate3d(${mx * -22}px, ${my * -22}px, 0)`;
                figure.style.transform = `translate3d(${mx * 14}px, ${my * 14}px, 0)`;
                if (orb) orb.style.rotate = `${mx * 2}deg`;
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    /* ========================== 09 CONTADORES ============================ */
    function initCounters() {
        const els = $$('.count');
        const fmt = (n, el) => (el.dataset.sep ? n.toLocaleString('es-MX') : String(n));
        const run = (el) => {
            const to = parseInt(el.dataset.to, 10) || 0;
            if (reduceMotion) { el.textContent = fmt(to, el); return; }
            const dur = 1900, t0 = performance.now();
            const step = (now) => {
                const p = clamp((now - t0) / dur, 0, 1);
                const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
                el.textContent = fmt(Math.round(to * eased), el);
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };
        if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
        const io = new IntersectionObserver((entries) => {
            entries.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); run(en.target); } });
        }, { threshold: 0.5 });
        els.forEach((el) => io.observe(el));
    }

    /* =================== 10 MAPA CORPORAL INTERACTIVO ==================== */
    function initBodyMap() {
        const conds = $$('.cond'), pins = $$('.pin'), section = $('#tratamos');
        if (!conds.length) return;
        let active = 0, paused = false, pauseTimer = 0, inView = false;

        const setActive = (n) => {
            active = n;
            conds.forEach((c, i) => {
                const on = i === n;
                c.classList.toggle('is-active', on);
                $('.cond__btn', c).setAttribute('aria-expanded', String(on));
            });
            pins.forEach((p, i) => p.classList.toggle('is-active', i === n));
        };
        const userChose = (n) => {
            setActive(n);
            paused = true; clearTimeout(pauseTimer);
            pauseTimer = setTimeout(() => { paused = false; }, 14000);
        };
        conds.forEach((c, i) => $('.cond__btn', c).addEventListener('click', () => userChose(i)));
        pins.forEach((p, i) => {
            p.addEventListener('click', () => userChose(i));
            if (finePointer) p.addEventListener('mouseenter', () => userChose(i));
        });

        // Recorrido automático mientras la sección está visible y nadie interactúa
        if (!reduceMotion) {
            if ('IntersectionObserver' in window) {
                new IntersectionObserver((en) => { inView = en[0].isIntersecting; }, { threshold: 0.25 }).observe(section);
            } else { inView = true; }
            setInterval(() => { if (inView && !paused && !document.hidden) setActive((active + 1) % conds.length); }, 5200);
        }
    }

    /* ============================= 11 VIDEOS ============================= */
    function initVideos() {
        const figs = $$('.vid');
        figs.forEach((fig) => {
            const video = $('video', fig), btn = $('.vid__play', fig);
            if (!video || !btn) return;
            btn.addEventListener('click', () => {
                figs.forEach((o) => { if (o !== fig) { const ov = $('video', o); if (ov) ov.pause(); } });
                video.controls = true;
                const p = video.play();
                if (p && p.catch) p.catch(() => { video.controls = true; });
            });
            video.addEventListener('play', () => fig.classList.add('is-playing'));
            const stop = () => { fig.classList.remove('is-playing'); video.controls = false; };
            video.addEventListener('pause', stop);
            video.addEventListener('ended', stop);
        });
        // Pausa automática al salir de pantalla
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((en) => { if (!en.isIntersecting) { const v = $('video', en.target); if (v && !v.paused) v.pause(); } });
            }, { threshold: 0.1 });
            figs.forEach((f) => io.observe(f));
        }
    }

    /* ============================ 12 FAQ ================================= */
    function initFaq() {
        const items = $$('.qa');
        items.forEach((qa) => {
            const btn = $('.qa__q', qa);
            btn.addEventListener('click', () => {
                const wasOpen = qa.classList.contains('is-open');
                items.forEach((o) => { o.classList.remove('is-open'); $('.qa__q', o).setAttribute('aria-expanded', 'false'); });
                if (!wasOpen) { qa.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
            });
        });
    }

    /* ================== 13 FORMULARIO → WHATSAPP ========================= */
    function toast(text) {
        const el = $('#toast');
        if (!el) return;
        el.textContent = text;
        el.classList.add('is-on');
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => el.classList.remove('is-on'), 4200);
    }

    function initForm() {
        const form = $('#wa-form');
        if (!form) return;
        const name = $('#f-name'), phone = $('#f-phone'), interest = $('#f-interest'), message = $('#f-msg'), submit = $('#f-submit');
        const label = $('span', submit);
        const baseLabel = label.textContent;

        const setError = (input, msg) => {
            const field = input.closest('.field');
            field.classList.toggle('has-error', Boolean(msg));
            const err = $('.field__err', field);
            if (err) err.textContent = msg || '';
            input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        };
        const validate = () => {
            let firstBad = null;
            if (name.value.trim().length < 2) { setError(name, 'Escribe tu nombre para poder atenderte.'); firstBad = firstBad || name; } else setError(name, '');
            if (!interest.value) { setError(interest, 'Elige qué te interesa.'); firstBad = firstBad || interest; } else setError(interest, '');
            return firstBad;
        };
        [name, interest].forEach((el) => el.addEventListener('input', () => setError(el, '')));
        interest.addEventListener('change', () => setError(interest, ''));

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const bad = validate();
            if (bad) { bad.focus(); return; }

            const parts = [`Hola, soy ${name.value.trim()}.`, `Me interesa: ${interest.value}.`];
            if (message.value.trim()) parts.push(`Te cuento: ${message.value.trim()}`);
            if (phone.value.trim()) parts.push(`Mi teléfono: ${phone.value.trim()}.`);
            parts.push('¿Me ayudan a agendar mi valoración?');
            const url = waUrl(parts.join(' '));

            submit.classList.add('is-loading');
            label.textContent = 'Abriendo WhatsApp…';
            // Se abre en el mismo gesto del usuario para que el navegador no bloquee la ventana
            const win = window.open(url, '_blank', 'noopener');
            if (!win) window.location.href = url;

            setTimeout(() => {
                submit.classList.remove('is-loading');
                label.textContent = baseLabel;
                form.reset();
                toast('¡Listo! Continúa tu mensaje en WhatsApp.');
            }, 1400);
        });
    }

    /* ============ 14 EFECTOS DE PUNTERO (solo dispositivos con ratón) ===== */
    function initPointerFx() {
        // Spotlight: luz que sigue al cursor dentro de tarjetas
        $$('.spot').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--sx', `${e.clientX - r.left}px`);
                el.style.setProperty('--sy', `${e.clientY - r.top}px`);
            }, { passive: true });
        });
        if (!finePointer || reduceMotion) return;

        // Tilt 3D
        $$('.tilt').forEach((el) => {
            const max = el.classList.contains('vid') ? 3.5 : 5;
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
                el.style.setProperty('--ry', `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
                el.style.setProperty('--rx', `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
            }, { passive: true });
            el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
        });

        // Botones magnéticos: se acercan al cursor como un imán
        $$('.magnetic').forEach((el) => {
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', `${((e.clientX - (r.left + r.width / 2)) * 0.22).toFixed(1)}px`);
                el.style.setProperty('--my', `${((e.clientY - (r.top + r.height / 2)) * 0.32).toFixed(1)}px`);
            }, { passive: true });
            el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
        });

        // Resplandor que sigue al cursor
        const glow = $('#cursor-glow');
        if (glow) {
            let gx = -500, gy = -500, tx = -500, ty = -500;
            document.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; glow.classList.add('is-on'); }, { passive: true });
            document.documentElement.addEventListener('mouseleave', () => glow.classList.remove('is-on'));
            const move = () => {
                gx = lerp(gx, tx, 0.12); gy = lerp(gy, ty, 0.12);
                glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
                requestAnimationFrame(move);
            };
            requestAnimationFrame(move);
        }
    }

    /* =================== 15 BOTÓN FLOTANTE Y ARRANQUE ==================== */
    function initFloat() {
        const fl = $('#wa-float');
        if (!fl) return;
        const show = (ms) => { fl.classList.add('is-tip'); setTimeout(() => fl.classList.remove('is-tip'), ms); };
        setTimeout(() => show(6500), 5200);
        setInterval(() => show(5000), 45000);
    }

    function init() {
        const year = $('#year');
        if (year) year.textContent = new Date().getFullYear();

        initWhatsAppLinks();
        initReveal();
        initRotator();
        initMeter();
        const menuApi = initMenu();
        initCurrentLink();
        initField();
        initScrollEffects(menuApi);
        initCounters();
        initBodyMap();
        initVideos();
        initFaq();
        initForm();
        initPointerFx();
        initFloat();
        initLoader(startHero);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
