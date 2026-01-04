// Content script that runs only on X.com article pages
// URL pattern: https://x.com/{username}/article/{article_id}

(function() {
  'use strict';

  let quotePopup = null;

  function getArticleInfo() {
    const url = window.location.href;
    const match = url.match(/x\.com\/([^\/]+)\/article\/(\d+)/);
    if (match) {
      return { username: match[1], articleId: match[2], url: url };
    }
    return null;
  }

  function applyWidthFix() {
    let changed = 0;

    const main = document.querySelector('main[role="main"].css-175oi2r.r-16y2uox.r-1wbh5a2.r-1habvwh');
    if (main) { main.className = 'w-full px-10'; changed++; }

    const div1 = document.querySelector('.css-175oi2r.r-150rngu.r-16y2uox.r-1wbh5a2.r-113js5t');
    if (div1) { div1.className = 'w-full'; changed++; }

    const div2 = document.querySelector('.css-175oi2r.r-18u37iz.r-1pi2tsx.r-bqdgw5.r-13qz1uu');
    if (div2) { div2.className = 'w-full'; changed++; }

    const div3 = document.querySelector('.css-175oi2r.r-1awozwy.r-1kihuf0.r-kemksi.r-3td2sv.r-1pi2tsx.r-zgris8.r-1v57z21.r-pm9dpa.r-z7pwl0.r-bnwqim.r-13qz1uu');
    if (div3) { div3.className = 'w-full'; changed++; }

    const div4 = document.querySelector('.css-175oi2r.r-1jnzvcq.r-o8wjku.r-vmopo1');
    if (div4) { div4.className = 'w-full'; changed++; }

    if (changed < 5) {
      setTimeout(applyWidthFix, 500);
    }
  }

  function createQuotePopup() {
    const popup = document.createElement('div');
    popup.id = 'x-article-quote-popup';
    popup.innerHTML = `
      <button id="x-quote-tweet-btn">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        <span>Quote Tweet</span>
      </button>
    `;
    document.body.appendChild(popup);
    return popup;
  }

  function hidePopup() {
    if (quotePopup) {
      quotePopup.classList.remove('visible');
    }
  }

  function showPopup(x, y, selectedText) {
    if (!quotePopup) {
      quotePopup = createQuotePopup();
    }

    const articleInfo = getArticleInfo();
    if (!articleInfo) return;

    // Position the popup above the selection
    const popupWidth = 140;
    const popupHeight = 40;
    
    let posX = x - (popupWidth / 2);
    let posY = y - popupHeight - 10;

    // Keep popup within viewport
    posX = Math.max(10, Math.min(posX, window.innerWidth - popupWidth - 10));
    posY = Math.max(10, posY);

    quotePopup.style.left = `${posX}px`;
    quotePopup.style.top = `${posY}px`;
    quotePopup.classList.add('visible');

    // Set up the click handler for the quote tweet button
    const btn = quotePopup.querySelector('#x-quote-tweet-btn');
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Compose the tweet text with the selected quote and article URL
      const tweetText = `"${selectedText}"\n\n${articleInfo.url}`;
      const encodedText = encodeURIComponent(tweetText);
      
      // Open X.com compose in a new tab
      const composeUrl = `https://x.com/intent/tweet?text=${encodedText}`;
      window.open(composeUrl, '_blank');
      
      hidePopup();
    };
  }

  function handleTextSelection() {
    document.addEventListener('mouseup', (e) => {
      // Small delay to let the selection finalize
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        if (selectedText.length > 0 && selectedText.length < 500) {
          // Get the position of the selection
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          const x = rect.left + (rect.width / 2) + window.scrollX;
          const y = rect.top + window.scrollY;
          
          showPopup(x, y, selectedText);
        } else {
          // Hide popup if clicking elsewhere or no selection
          if (!e.target.closest('#x-article-quote-popup')) {
            hidePopup();
          }
        }
      }, 10);
    });

    // Hide popup when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (!e.target.closest('#x-article-quote-popup')) {
        hidePopup();
      }
    });

    // Hide popup on scroll
    document.addEventListener('scroll', hidePopup, true);
  }

  function init() {
    if (getArticleInfo()) {
      applyWidthFix();
      handleTextSelection();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
