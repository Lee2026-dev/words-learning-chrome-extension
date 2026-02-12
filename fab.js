// fab.js - Floating Action Button Content Script

(function () {
    // Prevent duplicate injection
    if (document.getElementById('lingua-fab-host')) return;

    // Create Host
    const fabHost = document.createElement('div');
    fabHost.id = 'lingua-fab-host';
    fabHost.style.position = 'fixed';
    fabHost.style.right = '0'; // Immediately position to avoid FOUC usually, but CSS in shadow is better
    fabHost.style.top = '50%';
    fabHost.style.zIndex = '2147483646'; // Just below dashboard (MAX - 1)
    fabHost.style.pointerEvents = 'none'; // Let clicks pass through the host container area generally if we had a large area, but here we just have the button. 
    // Actually, setting pointer-events: none on the host might block clicking the button if the button is inside.
    // So let's keep it default (auto) for now, but ensure the host doesn't cover the whole screen.
    // Since we set right/top, it's 0x0 size by default unless content expands it? No, div is block.
    // Let's set dimensions to 0 or fit-content.
    fabHost.style.width = '0';
    fabHost.style.height = '0';
    fabHost.style.overflow = 'visible';

    // Create Shadow DOM
    const shadowRoot = fabHost.attachShadow({ mode: 'open' });

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
        .fab-btn {
            position: fixed;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background-color: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border: 1px solid rgba(0,0,0,0.05);
            cursor: pointer;
            z-index: 2147483646;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            pointer-events: auto; /* Re-enable pointer events for the button */
        }

        .fab-btn:hover {
            transform: translateY(-50%) scale(1.1);
            box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }
        
        .fab-btn:active {
            transform: translateY(-50%) scale(0.95);
        }

        .fab-icon {
            width: 24px;
            height: 24px;
            object-fit: contain;
        }
    `;
    shadowRoot.appendChild(style);

    // Create Button
    const fabBtn = document.createElement('div');
    fabBtn.className = 'fab-btn';
    fabBtn.title = 'Open LinguaLearn Dashboard';

    // Icon
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/icon.png');
    icon.className = 'fab-icon';
    fabBtn.appendChild(icon);

    shadowRoot.appendChild(fabBtn);

    // Append to Body
    document.body.appendChild(fabHost);

    // Event Listener
    fabBtn.addEventListener('click', () => {
        // Send message to background to toggle dashboard
        // We use a specific action so background knows it's from FAB
        chrome.runtime.sendMessage({ action: "toggleDashboardFromContent" });
    });

})();
