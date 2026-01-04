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
      <div class="x-popup-buttons">
        <button id="x-quote-tweet-btn">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          <span>Quote</span>
        </button>
        <button id="x-ask-grok-btn">
          <svg viewBox="0 0 33 32" width="16" height="16" fill="currentColor">
            <path d="M12.745 20.54l10.97-8.19c.539-.4 1.307-.244 1.564.38 1.349 3.288.746 7.241-1.938 9.955-2.683 2.714-6.417 3.31-9.83 1.954l-3.728 1.745c5.347 3.697 11.84 2.782 15.898-1.324 3.219-3.255 4.216-7.692 3.284-11.693l.008.009c-1.351-5.878.332-8.227 3.782-13.031L33 0l-4.54 4.59v-.014L12.743 20.544m-2.263 1.987c-3.837-3.707-3.175-9.446.1-12.755 2.42-2.449 6.388-3.448 9.852-1.979l3.72-1.737c-.67-.49-1.53-1.017-2.515-1.387-4.455-1.854-9.789-.931-13.41 2.728-3.483 3.523-4.579 8.94-2.697 13.561 1.405 3.454-.899 5.898-3.22 8.364C1.49 30.2.666 31.074 0 32l10.478-9.466"/>
          </svg>
          <span>Ask Grok</span>
        </button>
      </div>
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
    const popupWidth = 220;
    const popupHeight = 50;
    
    let posX = x - (popupWidth / 2);
    let posY = y - popupHeight - 10;

    // Keep popup within viewport
    posX = Math.max(10, Math.min(posX, window.innerWidth - popupWidth - 10));
    posY = Math.max(10, posY);

    quotePopup.style.left = `${posX}px`;
    quotePopup.style.top = `${posY}px`;
    quotePopup.classList.add('visible');

    // Set up click handler for Quote Tweet
    const quoteBtn = quotePopup.querySelector('#x-quote-tweet-btn');
    quoteBtn.onclick = (e) => {
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

    // Set up click handler for Ask Grok
    const grokBtn = quotePopup.querySelector('#x-ask-grok-btn');
    grokBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      sendToGrok(selectedText);
      hidePopup();
    };
  }

  // Send selected text to Grok sidebar
  function sendToGrok(text) {
    // First, try to open the Grok drawer if it's collapsed
    const grokDrawer = document.querySelector('[data-testid="GrokDrawer"]');
    
    // If the Grok drawer is not visible/expanded, click the Grok button to open it
    if (!grokDrawer || grokDrawer.offsetHeight < 100) {
      // Find the Grok button by its unique SVG path
      const grokButton = document.querySelector('button svg[viewBox="0 0 33 32"]')?.closest('button');
      if (grokButton) {
        grokButton.click();
      }
    }

    // Wait for the drawer to open, then fill the textarea
    setTimeout(() => {
      fillGrokTextarea(text);
    }, 400);
  }

  // Get the article URL converted to status URL (Grok can access /status/ but not /article/)
  function getStatusUrl() {
    const url = window.location.href;
    // Convert /article/ to /status/
    return url.replace('/article/', '/status/');
  }

  // Fill the Grok textarea with the selected text
  function fillGrokTextarea(text, retryCount = 0) {
    const maxRetries = 5;
    
    // Find the Grok drawer's textarea
    const grokDrawer = document.querySelector('[data-testid="GrokDrawer"]');
    if (!grokDrawer && retryCount < maxRetries) {
      setTimeout(() => fillGrokTextarea(text, retryCount + 1), 300);
      return;
    }

    const textarea = grokDrawer?.querySelector('textarea');
    if (!textarea && retryCount < maxRetries) {
      setTimeout(() => fillGrokTextarea(text, retryCount + 1), 200);
      return;
    }

    if (!textarea) return;

    // Get status URL for Grok to access
    const statusUrl = getStatusUrl();

    // Format the question with the status URL
    const prompt = `From this article: ${statusUrl}\n\nExplain this:\n\n"${text}"`;

    // Focus the textarea
    textarea.focus();
    
    // Use native input value setter to bypass React's controlled input
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    ).set;
    
    nativeInputValueSetter.call(textarea, prompt);
    
    // Dispatch input event to trigger React state update
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    textarea.dispatchEvent(inputEvent);
    
    // Also dispatch change event
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    textarea.dispatchEvent(changeEvent);
    
    // Position cursor at the end
    textarea.setSelectionRange(prompt.length, prompt.length);
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

  // Get article title from the page
  function getArticleTitle() {
    const titleEl = document.querySelector('[data-testid="twitter-article-title"]');
    return titleEl ? titleEl.textContent.trim() : 'this article';
  }

  // Intercept clicks on the existing Grok button to pre-fill article context
  function interceptGrokButton() {
    // Find and intercept the Grok button
    const attachGrokInterceptor = () => {
      const grokButton = document.querySelector('button svg[viewBox="0 0 33 32"]')?.closest('button');
      
      if (grokButton && !grokButton.dataset.intercepted) {
        grokButton.dataset.intercepted = 'true';
        
        grokButton.addEventListener('click', () => {
          // Wait for Grok drawer to open, then pre-fill with article context
          setTimeout(() => {
            fillGrokWithArticlePrompt();
          }, 400);
        });
      }
    };

    // Try immediately
    attachGrokInterceptor();
    
    // Also watch for the button to appear (it may load dynamically)
    const observer = new MutationObserver(() => {
      attachGrokInterceptor();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Fill Grok with a prompt about the entire article
  function fillGrokWithArticlePrompt(retryCount = 0) {
    const maxRetries = 5;
    
    const grokDrawer = document.querySelector('[data-testid="GrokDrawer"]');
    if (!grokDrawer && retryCount < maxRetries) {
      setTimeout(() => fillGrokWithArticlePrompt(retryCount + 1), 300);
      return;
    }

    const textarea = grokDrawer?.querySelector('textarea');
    if (!textarea && retryCount < maxRetries) {
      setTimeout(() => fillGrokWithArticlePrompt(retryCount + 1), 200);
      return;
    }

    if (!textarea) return;
    
    // Only pre-fill if the textarea is empty (user hasn't typed anything)
    if (textarea.value.trim() !== '') return;

    const statusUrl = getStatusUrl();
    const title = getArticleTitle();

    // Prompt for discussing the entire article
    const prompt = `I'm reading this article: "${title}"\n\n${statusUrl}\n\n`;

    textarea.focus();
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    ).set;
    
    nativeInputValueSetter.call(textarea, prompt);
    
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    textarea.dispatchEvent(inputEvent);
    
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    textarea.dispatchEvent(changeEvent);
    
    textarea.setSelectionRange(prompt.length, prompt.length);
  }

  function init() {
    if (getArticleInfo()) {
      applyWidthFix();
      handleTextSelection();
      watchForQuoteModal();
      interceptGrokButton();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
