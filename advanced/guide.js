(function(){

  // ── glossary term registry ───────────────────────────────────
  // Every entry here becomes a live link, at every occurrence, inside any
  // element carrying class="prose". Anchors point to glossary.html#slug —
  // that page doesn't exist yet, but the slugs below are the contract for
  // whenever it's built. Listed longest-phrase-first so a compound term
  // (e.g. "varjit svar") is matched whole before its component word
  // ("svar") gets a chance to match on its own.
  const GLOSSARY_BASE = 'glossary.html';
  const GLOSSARY_TERMS = [
    ['varjit svar',  'varjit-svar'],
    ['svarsthaan',   'svarsthaan'],
    ['hindustaanee', 'hindustaanee'],
    ['sampoorna',    'sampoorna'],
    ['moorchhanaa',  'moorchhanaa'],
    ['poorvaang',    'poorvaang'],
    ['uttaraang',    'uttaraang'],
    ['carnatic',     'carnatic-sargam'],
    ['raagish',      'raagish'],
    ['shadav',       'shadav'],
    ['samvaad',      'samvaad'],
    ['sargam',       'sargam'],
    ['shuddha',      'shuddha'],
    ['teevra',       'teevra'],
    ['audav',        'audav'],
    ['vakra',        'vakra'],
    ['komal',        'komal'],
    ['jaati',        'jaati'],
    ['thaat',        'thaat'],
    ['avaroh',       'avaroh'],
    ['aaroh',        'aaroh'],
    ['svar',         'svar'],
    ['raag',         'raag'],
    ['ang',          'ang'],
    ['samay',        'samay'],
    ['jod',          'jod']
  ];

  function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function buildGlossaryRegex(){
    const alt = GLOSSARY_TERMS.map(([term]) => escapeRegExp(term).replace(/ /g, '\\s+')).join('|');
    return new RegExp('\\b(' + alt + ')\\b', 'gi');
  }

  function anchorFor(matchedText){
    const norm = matchedText.toLowerCase().replace(/\s+/g, ' ').trim();
    const found = GLOSSARY_TERMS.find(([term]) => term === norm);
    return found ? found[1] : null;
  }

  // Walks the text nodes under `root`, wraps every glossary-term match in
  // a <a class="gloss" target="glossary">, and leaves everything else —
  // including text already inside a link, or inside a .no-gloss zone —
  // untouched.
  function linkifyGlossaryTerms(root){
    const regex = buildGlossaryRegex();

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        let el = node.parentElement;
        while (el && el !== root){
          if (el.tagName === 'A' || el.classList.contains('no-gloss')) return NodeFilter.FILTER_REJECT;
          el = el.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    textNodes.forEach(textNode => {
      const text = textNode.nodeValue;
      regex.lastIndex = 0;
      if (!regex.test(text)) return;
      regex.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(text))){
        if (match.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

        const anchor = anchorFor(match[0]);
        if (anchor){
          const a = document.createElement('a');
          a.href = GLOSSARY_BASE + '#' + anchor;
          a.target = 'glossary';
          a.className = 'gloss';
          a.textContent = match[0];
          frag.appendChild(a);
        } else {
          frag.appendChild(document.createTextNode(match[0]));
        }
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));

      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  document.querySelectorAll('.prose').forEach(linkifyGlossaryTerms);

  // ── table-of-contents scroll-spy ─────────────────────────────
  const sections = document.querySelectorAll('.guide-section[id]');
  const tocLinks = document.querySelectorAll('.guide-toc a[href^="#"]');

  if (sections.length && tocLinks.length && 'IntersectionObserver' in window){
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const link = document.querySelector('.guide-toc a[href="#' + entry.target.id + '"]');
        if (!link) return;
        tocLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });

    sections.forEach(s => observer.observe(s));
  }

})();
