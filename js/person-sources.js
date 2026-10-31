(function (root) {
    'use strict';
    function render(container, person) {
        container.replaceChildren();
        if (!person.sources?.length) return;
        const caption = document.createElement('p');
        caption.textContent = 'Источники биографии';
        caption.style.cssText = 'margin-top:1rem;font-weight:600;color:var(--burgundy)';
        const list = document.createElement('ul');
        list.style.cssText = 'padding-left:1.25rem;font-size:0.95rem;line-height:1.5;overflow-wrap:anywhere';
        for (const source of person.sources) {
            let url;
            try { url = new URL(source.url); } catch { continue; }
            if (!['http:', 'https:'].includes(url.protocol)) continue;
            const item = document.createElement('li');
            const link = document.createElement('a');
            link.href = url.href;
            link.textContent = source.title;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.style.color = 'var(--burgundy)';
            item.appendChild(link);
            list.appendChild(item);
        }
        container.append(caption, list);
        if (person.imageCredit) {
            const credit = document.createElement('small');
            credit.style.cssText = 'display:block;margin-top:0.75rem;line-height:1.4;color:#75695e';
            credit.textContent = person.imageCredit;
            if (person.imageSource) {
                const link = document.createElement('a');
                link.href = person.imageSource;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = ' Источник изображения.';
                credit.appendChild(link);
            }
            container.appendChild(credit);
        }
    }
    root.HeritageSources = { render };
})(globalThis);
