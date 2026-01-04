// Content script that runs only on X.com article pages
// URL pattern: https://x.com/{username}/article/{article_id}

(function() {
  'use strict';

  let quotePopup = null;
  let lastSelectedText = '';
  let quoteModalObserver = null;

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

    // Set up click handler
    const btn = quotePopup.querySelector('#x-quote-tweet-btn');
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Store the selected text for when the modal opens
      lastSelectedText = selectedText;
      
      // Find and click the Repost button to open the menu
      const repostBtn = document.querySelector('[data-testid="retweet"]');
      if (repostBtn) {
        repostBtn.click();
        
        // Wait for menu to appear, then click Quote option
        setTimeout(() => {
          clickQuoteOption();
        }, 200);
      }
      
      hidePopup();
    };
  }

  // Click the Quote option in the repost menu
  function clickQuoteOption() {
    // Look for the Quote menu item - it's typically in a dropdown/menu
    const menuItems = document.querySelectorAll('[role="menuitem"]');
    
    for (const item of menuItems) {
      const text = item.textContent.toLowerCase();
      if (text.includes('quote')) {
        item.click();
        return;
      }
    }

    // Alternative: look for any clickable element with "Quote" text
    const allElements = document.querySelectorAll('div, span, a');
    for (const el of allElements) {
      if (el.textContent.trim() === 'Quote' && el.closest('[role="menu"]')) {
        el.click();
        return;
      }
    }
  }

  // Fill the quote compose textarea with selected text
  function fillQuoteTextarea(textToInsert) {
    const textarea = document.querySelector('[data-testid="tweetTextarea_0"]');
    if (!textarea) return false;

    // Format: quote text with curly quotes (user can edit and add their thoughts)
    const quoteText = `"${textToInsert}"`;
    
    // Focus the textarea
    textarea.focus();
    
    // Insert text using execCommand (works with Draft.js contenteditable)
    document.execCommand('insertText', false, quoteText);
    
    // Dispatch events to notify React/Draft.js of changes
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Hide the "Add a comment" placeholder
    const placeholder = document.querySelector('.public-DraftEditorPlaceholder-root');
    if (placeholder) {
      placeholder.style.display = 'none';
    }
    
    return true;
  }

  // Watch for the Quote compose modal to appear
  function watchForQuoteModal() {
    quoteModalObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if a dialog/modal appeared with tweet compose
            const dialog = node.querySelector ? node.querySelector('[role="dialog"]') : null;
            const textarea = node.querySelector ? node.querySelector('[data-testid="tweetTextarea_0"]') : null;
            
            if (dialog || textarea || (node.getAttribute && node.getAttribute('role') === 'dialog')) {
              // Small delay to let the modal fully render
              setTimeout(() => {
                if (lastSelectedText) {
                  const filled = fillQuoteTextarea(lastSelectedText);
                  if (filled) {
                    // Clear the stored text after using it
                    lastSelectedText = '';
                  }
                }
              }, 300);
            }
          }
        }
      }
    });

    quoteModalObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
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
      watchForQuoteModal();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
