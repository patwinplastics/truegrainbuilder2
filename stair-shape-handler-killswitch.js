// ============================================================================
// STAIR SHAPE HANDLER KILLSWITCH
// ============================================================================
// Purpose: Remove the duplicate stairShape change handler that app.js attaches
//          inside setupStairEventListeners(). That handler passes the raw HTML
//          value ('l-shape') to onStairConfigChange('shape', ...), but the data
//          model expects 'l-shaped'. The correct handler lives in
//          stair-ui-wiring-patch.js, which loads after this file.
//
// Technique: Clone-and-replace each stairShape radio input. Cloning a DOM node
//            copies its attributes and state but NOT its event listeners,
//            effectively stripping the old handler.
//
// Load order: app.js -> this file -> stair-ui-wiring-patch.js -> init.js
// ============================================================================

(function () {
    'use strict';

    const radios = document.querySelectorAll('input[name="stairShape"]');

    if (radios.length === 0) {
        console.warn('[killswitch] No stairShape radios found; nothing to strip.');
        return;
    }

    radios.forEach(function (radio) {
        var parent = radio.parentNode;     // the <label class="radio-card ...">
        var clone  = radio.cloneNode(true); // deep clone, drops event listeners
        parent.replaceChild(clone, radio);
    });

    console.log('[killswitch] Stripped ' + radios.length + ' stairShape listeners from app.js handler.');
})();
