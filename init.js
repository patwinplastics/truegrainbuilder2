// ===================================================
// APPLICATION INITIALIZATION
// ===================================================

function initializeApp() {
    console.log('TrueGrain Deck Designer: Initializing...');

    // 1. Restore saved state
    loadState();

    // 2. Initialize base UI controls
    initDimensionControls();
    initStructureControls();
    initPatternControls();
    initColorSwatches();
    initOptionsControls();
    initEstimateControls();
    initWizardNavigation();
    initViewControls();
    initSceneControls();
    initExportActions();

    // 3. Initialize 3D scene
    preloadTextures();
    initScene();

    // 4. Initialize stair subsystem
    initStairUI();

    // 5. Initialize stair drag after scene is ready
    if (sceneInitialized) {
        initStairDragControls();
    }

    // 6. Subscribe UI updater to state changes
    subscribe(() => {
        updateUI();
        buildDeck();
    });

    // 7. Run initial UI update
    state.boardLayout = calculateOptimalBoardLayout();
    state.results = calculateAll();
    updateUI();

    console.log('TrueGrain Deck Designer: Ready');
}

// ===================================================
// DIMENSION CONTROLS (Step 1)
// ===================================================

function initDimensionControls() {
    const lengthSlider = document.getElementById('lengthSlider');
    const lengthInput = document.getElementById('lengthInput');
    if (lengthSlider && lengthInput) {
        lengthSlider.value = state.deckLength;
        lengthInput.value = state.deckLength;
        lengthSlider.addEventListener('input', (e) => {
            lengthInput.value = e.target.value;
            updateState({ deckLength: parseFloat(e.target.value) });
        });
        lengthInput.addEventListener('change', (e) => {
            const val = Math.max(CONFIG.dimensions.minLength, Math.min(CONFIG.dimensions.maxLength, parseFloat(e.target.value) || CONFIG.dimensions.defaultLength));
            e.target.value = val;
            lengthSlider.value = val;
            updateState({ deckLength: val });
        });
    }

    const widthSlider = document.getElementById('widthSlider');
    const widthInput = document.getElementById('widthInput');
    if (widthSlider && widthInput) {
        widthSlider.value = state.deckWidth;
        widthInput.value = state.deckWidth;
        widthSlider.addEventListener('input', (e) => {
            widthInput.value = e.target.value;
            updateState({ deckWidth: parseFloat(e.target.value) });
        });
        widthInput.addEventListener('change', (e) => {
            const val = Math.max(CONFIG.dimensions.minWidth, Math.min(CONFIG.dimensions.maxWidth, parseFloat(e.target.value) || CONFIG.dimensions.defaultWidth));
            e.target.value = val;
            widthSlider.value = val;
            updateState({ deckWidth: val });
        });
    }

    const heightSlider = document.getElementById('heightSlider');
    const heightInput = document.getElementById('heightInput');
    if (heightSlider && heightInput) {
        heightSlider.value = state.deckHeight;
        heightInput.value = state.deckHeight;
        heightSlider.addEventListener('input', (e) => {
            heightInput.value = e.target.value;
            updateState({ deckHeight: parseFloat(e.target.value) });
        });
        heightInput.addEventListener('change', (e) => {
            const val = Math.max(CONFIG.deck.minHeight, Math.min(CONFIG.deck.maxHeight, parseFloat(e.target.value) || CONFIG.deck.defaultHeight));
            e.target.value = val;
            heightSlider.value = val;
            updateState({ deckHeight: val });
        });
    }
}

// ===================================================
// STRUCTURE CONTROLS (Step 2)
// ===================================================

function initStructureControls() {
    document.querySelectorAll('.direction-btn').forEach(btn => {
        if (btn.dataset.direction === state.boardDirection) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
        btn.addEventListener('click', () => {
            document.querySelectorAll('.direction-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            updateState({ boardDirection: btn.dataset.direction });
        });
    });

    document.querySelectorAll('input[name="joistSpacing"]').forEach(input => {
        if (parseInt(input.value) === state.joistSpacing) {
            input.checked = true;
            input.closest('.radio-card').classList.add('selected');
        }
        input.addEventListener('change', (e) => {
            document.querySelectorAll('input[name="joistSpacing"]').forEach(radio => {
                radio.closest('.radio-card').classList.remove('selected');
            });
            e.target.closest('.radio-card').classList.add('selected');
            updateState({ joistSpacing: parseInt(e.target.value) });
        });
    });
}

// ===================================================
// PATTERN CONTROLS (Step 3)
// ===================================================

function initPatternControls() {
    document.querySelectorAll('.pattern-card').forEach(card => {
        if (card.dataset.pattern === state.pattern) {
            card.classList.add('selected');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        }
        card.addEventListener('click', () => {
            document.querySelectorAll('.pattern-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
            const pattern = card.dataset.pattern;
            updateState({ pattern });
            const borderWidthGroup = document.getElementById('borderWidthGroup');
            if (borderWidthGroup) {
                borderWidthGroup.style.display = pattern === 'picture-frame' ? 'block' : 'none';
            }
        });
    });

    const borderWidthSlider = document.getElementById('borderWidthSlider');
    const borderWidthInput = document.getElementById('borderWidthInput');
    if (borderWidthSlider && borderWidthInput) {
        borderWidthSlider.value = state.borderWidth;
        borderWidthInput.value = state.borderWidth;
        borderWidthSlider.addEventListener('input', (e) => {
            borderWidthInput.value = e.target.value;
            updateState({ borderWidth: parseInt(e.target.value) });
        });
        borderWidthInput.addEventListener('change', (e) => {
            const val = Math.max(1, Math.min(3, parseInt(e.target.value) || 1));
            e.target.value = val;
            borderWidthSlider.value = val;
            updateState({ borderWidth: val });
        });
    }

    const breakerSameColor = document.getElementById('breakerSameColor');
    if (breakerSameColor) {
        breakerSameColor.checked = state.breakerSameColor;
        breakerSameColor.addEventListener('change', (e) => {
            updateState({ breakerSameColor: e.target.checked });
            const container = document.getElementById('breakerColorSwatchesContainer');
            if (container) container.style.display = e.target.checked ? 'none' : 'block';
        });
    }

    const borderSameColor = document.getElementById('borderSameColor');
    if (borderSameColor) {
        borderSameColor.checked = state.borderSameColor;
        borderSameColor.addEventListener('change', (e) => {
            updateState({ borderSameColor: e.target.checked });
            const container = document.getElementById('borderColorSwatchesContainer');
            if (container) container.style.display = e.target.checked ? 'none' : 'block';
        });
    }
}

// ===================================================
// COLOR SWATCH CONTROLS (Step 4)
// ===================================================

function initColorSwatches() {
    const mainContainer = document.getElementById('mainColorSwatches');
    const breakerContainer = document.getElementById('breakerColorSwatches');
    const borderContainer = document.getElementById('borderColorSwatches');

    function createSwatches(container, selectedColorId, onSelect) {
        if (!container) return;
        container.innerHTML = '';
        CONFIG.colors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch' + (color.id === selectedColorId ? ' selected' : '');
            swatch.dataset.colorId = color.id;
            swatch.title = color.name;
            swatch.innerHTML = '<div class="color-swatch__preview" style="background-color: ' + color.hex + '"></div><span class="color-swatch__name">' + color.name + '</span>';
            swatch.addEventListener('click', () => {
                container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                onSelect(color.id);
            });
            container.appendChild(swatch);
        });
    }

    createSwatches(mainContainer, state.mainColor, (colorId) => {
        updateState({ mainColor: colorId });
    });
    createSwatches(breakerContainer, state.breakerColor, (colorId) => {
        updateState({ breakerColor: colorId });
    });
    createSwatches(borderContainer, state.borderColor, (colorId) => {
        updateState({ borderColor: colorId });
    });
}

// ===================================================
// OPTIONS CONTROLS (Step 5)
// ===================================================

function initOptionsControls() {
    const showRailings = document.getElementById('showRailings');
    if (showRailings) {
        showRailings.checked = state.showRailings;
        showRailings.addEventListener('change', (e) => {
            updateState({ showRailings: e.target.checked });
        });
    }
}

// ===================================================
// ESTIMATE CONTROLS (Step 6)
// ===================================================

function initEstimateControls() {
    const wasteSlider = document.getElementById('wasteSlider');
    const wasteInput = document.getElementById('wasteInput');
    if (wasteSlider && wasteInput) {
        wasteSlider.value = state.wastePercent;
        wasteInput.value = state.wastePercent;
        wasteSlider.addEventListener('input', (e) => {
            wasteInput.value = e.target.value;
            updateState({ wastePercent: parseInt(e.target.value) });
        });
        wasteInput.addEventListener('change', (e) => {
            const val = Math.max(CONFIG.waste.min, Math.min(CONFIG.waste.max, parseInt(e.target.value) || CONFIG.waste.default));
            e.target.value = val;
            wasteSlider.value = val;
            updateState({ wastePercent: val });
        });
    }

    const includeLaborEstimate = document.getElementById('includeLaborEstimate');
    if (includeLaborEstimate) {
        includeLaborEstimate.checked = state.includeLaborEstimate;
        includeLaborEstimate.addEventListener('change', (e) => {
            updateState({ includeLaborEstimate: e.target.checked });
        });
    }
}

// ===================================================
// WIZARD NAVIGATION
// ===================================================

function initWizardNavigation() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    function showStep(stepNumber) {
        stepNumber = Math.max(1, Math.min(state.totalSteps, stepNumber));
        state.currentStep = stepNumber;

        document.querySelectorAll('.step').forEach(section => {
            const sectionStep = parseInt(section.dataset.step);
            section.classList.toggle('hidden', sectionStep !== stepNumber);
        });

        document.querySelectorAll('.progress-step').forEach(step => {
            const num = parseInt(step.dataset.step);
            step.classList.remove('active', 'completed');
            if (num === stepNumber) {
                step.classList.add('active');
            } else if (num < stepNumber) {
                step.classList.add('completed');
            }
        });

        if (prevBtn) prevBtn.disabled = stepNumber <= 1;
        if (nextBtn) {
            nextBtn.style.display = stepNumber >= state.totalSteps ? 'none' : '';
        }

        if (stepNumber === 6 || stepNumber === 7) {
            updateUI();
        }
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => showStep(state.currentStep - 1));
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => showStep(state.currentStep + 1));
    }

    document.querySelectorAll('.progress-step').forEach(step => {
        step.style.cursor = 'pointer';
        step.addEventListener('click', () => {
            const targetStep = parseInt(step.dataset.step);
            if (targetStep) showStep(targetStep);
        });
    });

    showStep(state.currentStep);
}

// ===================================================
// VIEW CONTROLS (3D / Top Down toggle)
// ===================================================

function initViewControls() {
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const view = btn.dataset.view;
            if (view === 'top' && camera && controls) {
                const maxDim = Math.max(state.deckLength, state.deckWidth);
                camera.position.set(0, maxDim * 2, 0.01);
                controls.target.set(0, state.deckHeight, 0);
                controls.update();
            } else if (view === '3d' && camera && controls) {
                const maxDim = Math.max(state.deckLength, state.deckWidth);
                camera.position.set(maxDim * 1.5, state.deckHeight + maxDim * 1.05, maxDim * 1.5);
                controls.target.set(0, state.deckHeight, 0);
                controls.update();
            }
        });
    });

    const mobileToggle = document.getElementById('mobileViewToggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            const vizPanel = document.querySelector('.visualization-panel');
            const wizardPanel = document.querySelector('.wizard-panel');
            if (vizPanel && wizardPanel) {
                const isShowingViz = vizPanel.classList.contains('mobile-visible');
                vizPanel.classList.toggle('mobile-visible');
                wizardPanel.classList.toggle('mobile-hidden');
                mobileToggle.textContent = isShowingViz ? 'View 3D' : 'Edit Design';
            }
        });
    }
}

// ===================================================
// SCENE CONTROLS (Zoom, Reset)
// ===================================================

function initSceneControls() {
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            if (camera) {
                camera.position.multiplyScalar(0.8);
                if (controls) controls.update();
            }
        });
    }
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            if (camera) {
                camera.position.multiplyScalar(1.25);
                if (controls) controls.update();
            }
        });
    }
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => {
            if (camera && controls) {
                const maxDim = Math.max(state.deckLength, state.deckWidth);
                camera.position.set(maxDim * 1.5, state.deckHeight + maxDim * 1.05, maxDim * 1.5);
                controls.target.set(0, state.deckHeight, 0);
                controls.update();
            }
        });
    }
}

// ===================================================
// EXPORT ACTIONS (Step 7)
// ===================================================

function initExportActions() {
    const contactFields = [
        { id: 'contactName', key: 'contactName' },
        { id: 'contactEmail', key: 'contactEmail' },
        { id: 'contactPhone', key: 'contactPhone' },
        { id: 'contactZip', key: 'contactZip' }
    ];
    contactFields.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = state[key] || '';
            el.addEventListener('input', (e) => {
                state[key] = e.target.value;
                debouncedSaveState();
            });
        }
    });

    const emailMyselfBtn = document.getElementById('emailMyselfBtn');
    if (emailMyselfBtn) {
        emailMyselfBtn.addEventListener('click', () => handleEmailMyself());
    }
    const submitToSalesBtn = document.getElementById('submitToSalesBtn');
    if (submitToSalesBtn) {
        submitToSalesBtn.addEventListener('click', () => handleSubmitToSales());
    }
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => handleDownloadPdf());
    }
}

// ===================================================
// EXPORT HANDLERS (safe fallbacks if not in app.js)
// ===================================================

if (typeof handleEmailMyself === 'undefined') {
    function handleEmailMyself() {
        const email = state.contactEmail;
        if (!email || !email.includes('@')) {
            alert('Please enter a valid email address.');
            return;
        }
        const formData = new FormData();
        formData.append('email', email);
        formData.append('name', state.contactName);
        formData.append('phone', state.contactPhone);
        formData.append('zip', state.contactZip);
        formData.append('deckSize', state.deckLength + "' x " + state.deckWidth + "'");
        formData.append('squareFootage', state.deckLength * state.deckWidth + ' sq ft');
        formData.append('color', state.mainColor);
        formData.append('pattern', state.pattern);
        if (state.results) {
            formData.append('totalBoards', state.results.boards.total);
            formData.append('linealFeet', state.results.boards.linealFeet);
            formData.append('estimateLow', '$' + state.results.costs.grandTotal.materialsOnly.low.toLocaleString());
            formData.append('estimateHigh', '$' + state.results.costs.grandTotal.materialsOnly.high.toLocaleString());
        }
        fetch(CONFIG.formspreeEndpoint, {
            method: 'POST', body: formData, headers: { 'Accept': 'application/json' }
        }).then(response => {
            const successMsg = document.getElementById('quoteSuccessMessage');
            if (response.ok && successMsg) {
                successMsg.classList.remove('hidden');
                successMsg.innerHTML = '<div class="success-card"><h4>Quote Sent!</h4><p>Check your inbox at <strong>' + email + '</strong> for your deck estimate.</p></div>';
            } else {
                alert('There was an issue sending the quote. Please try again.');
            }
        }).catch(() => {
            alert('Network error. Please check your connection and try again.');
        });
    }
}

if (typeof handleSubmitToSales === 'undefined') {
    function handleSubmitToSales() {
        const name = state.contactName;
        const email = state.contactEmail;
        if (!name || !email) {
            alert('Please enter your name and email before submitting.');
            return;
        }
        const formData = new FormData();
        formData.append('_subject', 'TrueGrain Deck Quote Request from ' + name);
        formData.append('name', name);
        formData.append('email', email);
        formData.append('phone', state.contactPhone);
        formData.append('zip', state.contactZip);
        formData.append('deckSize', state.deckLength + "' x " + state.deckWidth + "'");
        formData.append('squareFootage', state.deckLength * state.deckWidth + ' sq ft');
        formData.append('deckHeight', state.deckHeight + ' ft');
        formData.append('color', state.mainColor);
        formData.append('pattern', state.pattern);
        formData.append('boardDirection', state.boardDirection);
        formData.append('joistSpacing', state.joistSpacing + '" O.C.');
        if (state.results) {
            formData.append('totalBoards', state.results.boards.total);
            formData.append('linealFeet', state.results.boards.linealFeet);
            formData.append('estimateLow', '$' + state.results.costs.grandTotal.materialsOnly.low.toLocaleString());
            formData.append('estimateHigh', '$' + state.results.costs.grandTotal.materialsOnly.high.toLocaleString());
        }
        if (state.stairsEnabled && state.stairs.length > 0) {
            formData.append('stairs', state.stairs.length + ' stair(s)');
        }
        fetch(CONFIG.formspreeEndpoint, {
            method: 'POST', body: formData, headers: { 'Accept': 'application/json' }
        }).then(response => {
            const successMsg = document.getElementById('quoteSuccessMessage');
            if (response.ok && successMsg) {
                successMsg.classList.remove('hidden');
                successMsg.innerHTML = '<div class="success-card"><h4>Request Submitted!</h4><p>Our sales team will contact you at <strong>' + email + '</strong> shortly.</p></div>';
            } else {
                alert('There was an issue submitting. Please try again.');
            }
        }).catch(() => {
            alert('Network error. Please check your connection and try again.');
        });
    }
}

if (typeof handleDownloadPdf === 'undefined') {
    function handleDownloadPdf() {
        if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
            alert('PDF library is still loading. Please try again in a moment.');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const colorName = CONFIG.colors.find(c => c.id === state.mainColor)?.name || state.mainColor;
        doc.setFontSize(20);
        doc.text('TrueGrain Deck Estimate', 20, 20);
        doc.setFontSize(12);
        let y = 35;
        const line = (label, value) => { doc.text(label + ': ' + value, 20, y); y += 8; };
        line('Dimensions', state.deckLength + "' x " + state.deckWidth + "'");
        line('Total Area', (state.deckLength * state.deckWidth) + ' sq ft');
        line('Deck Height', state.deckHeight + ' ft');
        line('Color', colorName);
        line('Pattern', state.pattern);
        line('Board Direction', state.boardDirection === 'length' ? 'Lengthwise' : 'Widthwise');
        line('Joist Spacing', state.joistSpacing + '" O.C.');
        if (state.results) {
            y += 5;
            doc.setFontSize(14);
            doc.text('Materials', 20, y); y += 10;
            doc.setFontSize(12);
            line('Total Boards', state.results.boards.total + ' boards');
            line('Lineal Feet', state.results.boards.linealFeet + ' LF');
            line('Clip Boxes', state.results.hardware.clipBoxes + ' boxes');
            line('Screw Boxes', state.results.hardware.screwBoxes + ' boxes');
            y += 5;
            doc.setFontSize(14);
            doc.text('Estimated Cost', 20, y); y += 10;
            doc.setFontSize(12);
            line('Materials', '$' + state.results.costs.grandTotal.materialsOnly.low.toLocaleString() + ' - $' + state.results.costs.grandTotal.materialsOnly.high.toLocaleString());
        }
        if (state.stairsEnabled && state.stairs.length > 0) {
            y += 5;
            doc.setFontSize(14);
            doc.text('Stairs (' + state.stairs.length + ')', 20, y); y += 10;
            doc.setFontSize(12);
            const stairMats = calculateAllStairMaterials();
            if (stairMats) {
                line('Tread Boards', stairMats.treads.total + ' boards');
                line('Riser Boards', stairMats.risers.total + ' boards');
                line('Stringers', stairMats.stringers.count + ' stringers');
            }
        }
        y += 10;
        doc.setFontSize(9);
        doc.setTextColor(128);
        doc.text('Generated by TrueGrain Deck Designer', 20, y);
        doc.text(CONFIG.companyInfo.phone + ' | ' + CONFIG.companyInfo.email, 20, y + 5);
        doc.save('TrueGrain-Deck-Estimate.pdf');
    }
}

// ===================================================
// DOM READY - BOOT THE APP
// ===================================================

document.addEventListener('DOMContentLoaded', initializeApp);

// Fallback: if DOM already loaded (script at bottom of body)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initializeApp, 0);
}
